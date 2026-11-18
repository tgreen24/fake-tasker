import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const PROJECT = 'demo-fake-tasker';
export const APP_PORT = 3100;
export const BASE = `http://localhost:${APP_PORT}`;
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

export function serve(root) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, BASE).pathname);
    let file = join(root, path);
    try {
      if (!(await stat(file)).isFile()) throw new Error('dir');
    } catch {
      file = join(root, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((resolve) => server.listen(APP_PORT, () => resolve(server)));
}

// ── reading the truth straight from the emulator, past the rules ──

function decode(value) {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

const decodeFields = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));

export async function readDoc(path) {
  const res = await fetch(`${FIRESTORE}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: 'Bearer owner' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return decodeFields((await res.json()).fields || {});
}

export const readGame = (code) => readDoc(`games/${code}`);
export const readSeat = (code, name) => readDoc(`games/${code}/players/${name}`);

// The same decision the app makes, so a phone can be judged against where the
// server says it should be rather than against where its own copy says.
export function expectedPath(game, name, code, now = Date.now()) {
  if (!game) return '/';
  const players = game.players || [];
  if (name && players.length > 0 && !players.includes(name)) return '/';
  const until = game.resultUntil;
  if (until && now < until && until - now <= 5000) return `/voting/${code}`;
  if (game.gameEnded) return `/gameover/${code}`;
  if (game.meetingCalled) return `/voting/${code}`;
  if (game.gameStarted) return `/countdown/${code}`;
  return `/lobby/${code}`;
}

// ── a phone ──

// Lets the simulator hide the page the way a locked phone does. Chromium's own
// visibility cannot be driven from outside, and the app reads document.hidden
// to decide whether it may do anything at all.
const VISIBILITY_SHIM = () => {
  let hidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(Document.prototype, 'visibilityState', {
    get: () => (hidden ? 'hidden' : 'visible'), configurable: true
  });
  window.__sim = {
    hide() {
      hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    show() {
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    }
  };
};

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export class Phone {
  constructor(browser, name) {
    this.browser = browser;
    this.name = name;
    this.logs = [];
    this.asleep = false;
  }

  async open() {
    this.context = await this.browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: IPHONE_UA
    });
    await this.context.addInitScript(VISIBILITY_SHIM);
    this.page = await this.context.newPage();
    this.cdp = await this.context.newCDPSession(this.page);
    this.page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        this.logs.push(`[${new Date().toISOString().slice(11, 23)}] ${msg.type()}: ${msg.text().slice(0, 300)}`);
      }
    });
    this.page.on('pageerror', (error) => this.logs.push(`pageerror: ${error.message}`));
    return this;
  }

  async close() {
    await this.context?.close().catch(() => {});
  }

  path() {
    return new URL(this.page.url()).pathname;
  }

  // iOS stops a locked phone's JavaScript and, given long enough, its sockets.
  // 'offline' fails every request; 'stall' is the nastier one -- requests in
  // flight never answer at all, and nothing tells the page they are dead.
  async sleep({ offline = true, stall = false } = {}) {
    await this.page.evaluate(() => window.__sim.hide());
    if (stall) {
      this.stalled = true;
      await this.context.route(/:8080\//, () => {});
    } else if (offline) {
      await this.context.setOffline(true);
    }
    await this.cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    this.asleep = true;
  }

  async wake({ discarded = false } = {}) {
    if (this.stalled) {
      await this.context.unroute(/:8080\//);
      this.stalled = false;
    }
    await this.context.setOffline(false);
    if (discarded) {
      const url = this.page.url();
      await this.page.close();
      this.page = await this.context.newPage();
      this.cdp = await this.context.newCDPSession(this.page);
      await this.page.goto(url);
    } else {
      await this.cdp.send('Page.setWebLifecycleState', { state: 'active' });
      await this.page.evaluate(() => window.__sim.show());
    }
    this.asleep = false;
    this.wokeAt = Date.now();
  }

  async reload() {
    await this.page.reload();
  }

  async goto(path) {
    await this.page.goto(`${BASE}${path}`);
  }

  async text() {
    return this.page.locator('body').innerText().catch(() => '');
  }

  button(name, exact = true) {
    return this.page.getByRole('button', { name, exact });
  }
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(check, { timeout = 15000, every = 250, what = 'condition' } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try {
      last = await check();
      if (last) return { ms: Date.now() - started, value: last };
    } catch (error) {
      last = error;
    }
    await pause(every);
  }
  const error = new Error(`timed out after ${timeout}ms waiting for ${what}`);
  error.last = last;
  throw error;
}
