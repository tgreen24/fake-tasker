import { chromium, webkit } from 'playwright';
import { Phone, serve } from './phones.mjs';
import { makeSolvers } from './solvers.mjs';

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


const solvers = makeSolvers(record);


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
