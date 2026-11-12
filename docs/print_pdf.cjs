// Prints docs/how-projects-get-approved.html to docs/how-projects-get-approved.pdf.
// Needs Playwright with Chromium:  node docs/print_pdf.cjs
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const html = path.join(__dirname, 'how-projects-get-approved.html');
  const pdf = path.join(__dirname, 'how-projects-get-approved.pdf');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  // Each section must fit on one Letter page (970 px of printable height).
  const tall = await page.evaluate(() => [...document.querySelectorAll('.page')]
    .map((p, i) => [i + 1, Math.round(p.getBoundingClientRect().height)]).filter(([, h]) => h > 970));
  if (tall.length) throw new Error('Too tall for one page: ' + JSON.stringify(tall));
  await page.pdf({ path: pdf, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('wrote ' + pdf);
})().catch(e => { console.error(e); process.exit(1); });
