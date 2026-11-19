import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { Phone, pause, serve } from './phones.mjs';

// Plays every Practice minigame through its screen, the way a person would --
// real drags, real five second holds -- on a small phone, and fails any that
// cannot be finished or that push the page sideways.

const engine = process.env.SIM_ENGINE === 'webkit' ? webkit : chromium;
const WIDTH = 320;
const results = [];
const record = (check, pass, detail = '') => {
  results.push({ check, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? `  (${detail})` : ''}`);
};

// The answer is found the way a person would: which grocery uses exactly
// these letters. No two groceries share their letters, so it is unambiguous.
const groceryList = [...(await readFile('src/game/minigames/groceries.js', 'utf8')).matchAll(/'([A-Z]{4,7})'/g)]
  .map(([, word]) => word);
const sortLetters = (letters) => [...letters].sort().join('');
const groceryFor = (letters) => groceryList.find((word) => sortLetters(word) === sortLetters(letters));

// Both the page scrolling sideways and anything poking out of the minigame's
// own box, which the minigame clips -- clipped is still broken, just hidden.
async function sideways(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const page = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width;
    const box = document.querySelector('.minigame')?.getBoundingClientRect();
    const inside = box ? Math.max(0, ...[...document.querySelectorAll('.minigame *')].map((el) => {
      const r = el.getBoundingClientRect();
      return r.width && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.dragging')
        ? Math.max(r.right - box.right - 6, box.left - r.left - 6) : 0;
    })) : 0;
    return Math.round(Math.max(page, inside));
  });
}

async function hold(page, locator, ms) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await pause(ms);
  await page.mouse.up();
}

async function dragTo(page, from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(
      a.x + a.width / 2 + ((b.x + b.width / 2) - (a.x + a.width / 2)) * (step / 8),
      a.y + a.height / 2 + ((b.y + b.height / 2) - (a.y + a.height / 2)) * (step / 8)
    );
    await pause(20);
  }
  await page.mouse.up();
}

const solvers = {
  async 'Match the Socks'(phone) {
    const cards = phone.page.locator('.sock-card');
    const styles = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.style));
    // One wrong pair first, which has to flip back over.
    const wrong = styles.findIndex((style) => style !== styles[0]);
    await cards.nth(0).click();
    await cards.nth(wrong).click();
    await pause(1000);
    record('a wrong pair flips back over', (await phone.page.locator('.sock-card.face-up').count()) === 0);
    const done = new Set();
    for (let i = 0; i < styles.length; i++) {
      if (done.has(styles[i])) continue;
      const partner = styles.findIndex((style, j) => j !== i && style === styles[i]);
      await cards.nth(i).click();
      await cards.nth(partner).click();
      done.add(styles[i]);
      await pause(100);
    }
  },

  async 'Charge the Batteries'(phone) {
    const batteries = phone.page.locator('.battery');
    // Two fingers at once, as separate touches: only the first may charge.
    await phone.page.evaluate(() => {
      const [first, second] = document.querySelectorAll('.battery');
      const touch = (node, pointerId, type) => node.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 1
      }));
      touch(first, 1, 'pointerdown');
      touch(second, 2, 'pointerdown');
      window.__releaseBatteries = () => {
        touch(first, 1, 'pointerup');
        touch(second, 2, 'pointerup');
      };
    });
    await pause(1500);
    const second = await batteries.nth(1).getAttribute('aria-label');
    await phone.page.evaluate(() => window.__releaseBatteries());
    record('a second finger on another battery does not charge it', /, 0 percent/.test(second), second);
    await pause(3000);
    await hold(phone.page, batteries.nth(0), 1500);
    await pause(1500);
    const drained = await batteries.nth(0).getAttribute('aria-label');
    record('letting go early drains the battery', /percent/.test(drained) && Number(drained.match(/(\d+) percent/)[1]) < 30, drained);
    for (let i = 0; i < 3; i++) await hold(phone.page, batteries.nth(i), 5400);
  },

  async 'Fix the Wiring'(phone) {
    for (let panel = 1; panel <= 3; panel++) {
      await phone.page.getByText(`Panel ${panel} of 3`).waitFor({ timeout: 3000 });
      const ids = await phone.page.locator('.wiring-column').first().locator('button')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').replace('Wire ', '')));
      if (panel === 1) {
        await phone.button(`Wire ${ids[0]}`).click();
        await phone.button(`Socket ${ids[1]}`).click();
        record('a wrong socket does not connect', (await phone.page.locator('.wire-end.connected').count()) === 0);
      }
      for (const id of ids) {
        await phone.button(`Wire ${id}`).click();
        await phone.button(`Socket ${id}`).click();
      }
    }
  },

  async 'Unscramble the Grocery List'(phone) {
    for (let item = 1; item <= 3; item++) {
      await phone.page.getByText(`Item ${item} of 3`).waitFor({ timeout: 3000 });
      const tiles = phone.page.locator('.letter-tile');
      const letters = await tiles.evaluateAll((nodes) => nodes.map((node) => node.dataset.letter));
      const word = groceryFor(letters.join(''));
      if (item === 1) {
        // The order shown is never the answer, so spelling it out must be
        // turned away and cleared.
        for (let i = 0; i < letters.length; i++) await tiles.nth(i).click();
        await pause(1000);
        record('a wrong spelling is cleared', (await phone.page.locator('.letter-slot.filled').count()) === 0);
        await phone.button('Hint').click();
        const first = (await phone.page.locator('.letter-slot.filled').first().innerText()).trim();
        record('a hint places the right first letter', first === word[0], `${first} for ${word}`);
        record('hints then wait three seconds', await phone.page.locator('.unscramble-hint').isDisabled());
        await phone.page.locator('.letter-slot.filled').first().click();
      }
      const used = new Set();
      for (const letter of word) {
        const index = letters.findIndex((l, i) => l === letter && !used.has(i));
        used.add(index);
        await tiles.nth(index).click();
      }
    }
  },

  async 'Sort the Laundry'(phone) {
    const pieces = phone.page.locator('.laundry-piece');
    const labels = await pieces.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    const basketFor = (label) => phone.button(label.startsWith('White') ? 'Whites basket' : 'Colors basket');
    const wrongFor = (label) => phone.button(label.startsWith('White') ? 'Colors basket' : 'Whites basket');
    await dragTo(phone.page, pieces.nth(0), wrongFor(labels[0]));
    await pause(300);
    record('a piece dropped in the wrong basket stays out', (await phone.page.locator('.laundry-piece.sorted').count()) === 0);
    // One by tapping, the rest by dragging.
    await pieces.nth(0).click();
    await basketFor(labels[0]).click();
    record('tapping a piece then a basket sorts it', (await phone.page.locator('.laundry-piece.sorted').count()) === 1);
    for (let i = 1; i < labels.length; i++) {
      await dragTo(phone.page, pieces.nth(i), basketFor(labels[i]));
      await pause(150);
    }
  },

  async 'Make Change'(phone) {
    let triedTooMuch = false;
    for (let customer = 1; customer <= 3; customer++) {
      await phone.page.getByText(`Customer ${customer} of 3`).waitFor({ timeout: 3000 });
      const amounts = await phone.page.locator('.change-receipt strong').allInnerTexts();
      const [price, paid] = amounts.map((text) => Math.round(Number(text.replace('$', '')) * 100));
      let owed = paid - price;
      if (customer === 1 && owed >= 75) {
        const quarter = phone.page.getByRole('button', { name: /^Give 25¢/ });
        for (let i = 0; i < 3; i++) await quarter.click();
        record('the quarters run out after three', await quarter.isDisabled());
        await phone.button('Take it back').click();
      }
      if (!triedTooMuch && owed < 1000) {
        triedTooMuch = true;
        await phone.page.getByRole('button', { name: /^Give \$10/ }).click();
        await phone.page.getByText('Too much! Start again').waitFor({ timeout: 2000 })
          .then(() => record('too much change is refused', true))
          .catch(() => record('too much change is refused', false));
        await phone.page.getByText('Change given: $0.00').waitFor({ timeout: 3000 });
      }
      for (const [cents, label] of [[1000, '$10'], [500, '$5'], [100, '$1'], [25, '25¢']]) {
        while (owed >= cents) {
          await phone.page.getByRole('button', { name: new RegExp(`^Give ${label.replace('$', '\\$')},`) }).click();
          owed -= cents;
        }
      }
    }
  },

  async 'Program the Microwave'(phone) {
    const watch = async () => {
      const seen = [];
      let showing = null;
      const keys = phone.page.locator('.microwave-key');
      await phone.page.getByText('WATCH', { exact: true }).waitFor({ timeout: 4000 });
      while (await keys.first().isDisabled()) {
        const lit = await phone.page.locator('.microwave-key[data-lit]').first().innerText({ timeout: 50 }).catch(() => null);
        if (lit && lit !== showing) seen.push(lit);
        showing = lit;
        await pause(30);
      }
      return seen;
    };
    for (let round = 1; round <= 3; round++) {
      await phone.page.getByText(`Round ${round} of 3`).waitFor({ timeout: 4000 });
      let pattern = await watch();
      if (round === 1) {
        const wrong = ['1', '2', '3'].find((key) => key !== pattern[0]);
        await phone.button(`Key ${wrong}`).click();
        await phone.page.getByText('ERROR', { exact: true }).waitFor({ timeout: 2000 })
          .then(() => record('a wrong key replays the pattern', true))
          .catch(() => record('a wrong key replays the pattern', false));
        pattern = await watch();
      }
      record(`round ${round} shows ${round + 2} keys`, pattern.length === round + 2, pattern.join(''));
      for (const key of pattern) await phone.button(`Key ${key}`).click();
    }
  },

  async 'Find the Remote'(phone) {
    const follow = async () => {
      await phone.page.getByText('Watch where the remote goes').waitFor({ timeout: 5000 });
      const marked = phone.page.locator('.cushion[data-remote]');
      await marked.first().waitFor({ timeout: 5000 });
      const label = await marked.first().getAttribute('aria-label');
      await phone.page.getByText('Which cushion is it under?').waitFor({ timeout: 8000 });
      return label;
    };
    for (let round = 1; round <= 3; round++) {
      await phone.page.getByText(`Round ${round} of 3`).waitFor({ timeout: 5000 });
      let label = await follow();
      if (round === 1) {
        const wrong = ['Cushion 1', 'Cushion 2', 'Cushion 3'].find((name) => name !== label);
        await phone.button(wrong).click();
        await phone.page.getByText('Not there! Watch again').waitFor({ timeout: 2000 })
          .then(() => record('a wrong cushion shows where it was and goes again', true))
          .catch(() => record('a wrong cushion shows where it was and goes again', false));
        label = await follow();
      }
      await phone.button(label).click();
    }
  },

  async 'Scrub the Dishes'(phone) {
    // Rub back and forth across whichever plate is up, never off its edge,
    // until the last one is done.
    for (let pass = 0; pass < 12; pass++) {
      if (await phone.page.getByText('Dishes done!').count()) return;
      const box = await phone.page.locator('.plate').boundingBox();
      const r = box.width / 2;
      const cx = box.x + r;
      const cy = box.y + r;
      const across = (dy) => Math.sqrt(Math.max(0, (r - 10) ** 2 - dy ** 2));
      await phone.page.mouse.move(cx, cy - r + 14);
      await phone.page.mouse.down();
      for (let dy = -r + 14; dy < r - 14; dy += 12) {
        await phone.page.mouse.move(cx - across(dy), cy + dy, { steps: 4 });
        await phone.page.mouse.move(cx + across(dy), cy + dy + 6, { steps: 4 });
      }
      await phone.page.mouse.up();
      await pause(700);
    }
  },

  async 'Turn Off the Lights'(phone) {
    const started = Date.now();
    while (!(await phone.page.getByText('Lights out. Goodnight!').count()) && Date.now() - started < 40000) {
      const lit = phone.page.locator('.house-window.lit');
      if (await lit.count()) await lit.first().click({ timeout: 500 }).catch(() => {});
      else await pause(50);
    }
  },

  async 'Tap in Order'(phone) {
    for (let n = 1; n <= 9; n++) await phone.button(`Tap ${n}`).click();
  }
};

const server = await serve('build-sim');
const browser = await engine.launch({ headless: process.env.SIM_HEADED !== '1' });
const phone = await new Phone(browser, 'Player').open();
await phone.page.setViewportSize({ width: WIDTH, height: 700 });

const only = process.env.MINIGAME;
for (const [name, solve] of Object.entries(solvers)) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
  console.log(`\n▶ ${name}`);
  await phone.goto('/practice');
  await phone.button(name).click();
  const over = await sideways(phone.page);
  record(`fits a ${WIDTH}px screen`, over <= 0, over > 0 ? `${over}px too wide` : '');
  const started = Date.now();
  try {
    await solve(phone);
    await phone.page.getByText(/Solved in/).waitFor({ timeout: 8000 });
    record('it can be solved', true, `${((Date.now() - started) / 1000).toFixed(1)}s by the bot`);
  } catch (error) {
    record('it can be solved', false, error.message.split('\n')[0]);
    await phone.page.screenshot({ path: `sim-results/minigame-${name.replace(/\W+/g, '-')}.png` });
  }
  const overAfter = await sideways(phone.page);
  record('still fits once solved', overAfter <= 0, overAfter > 0 ? `${overAfter}px too wide` : '');
}

await phone.close();
await browser.close();
server.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
