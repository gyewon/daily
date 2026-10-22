const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
let executablePath = edgePaths.find(p => fs.existsSync(p));

(async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1787, height: 1084 }
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.toString()));

  await page.goto('file:///D:/AI%20App/daily/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 4000));

  // Check physicalCardsContainer
  const cardItems = await page.$$eval('#physicalCardsContainer .card-item', items => {
    return items.map(el => {
      const title = el.querySelector('.card-title')?.innerText?.trim();
      const chipColor = el.querySelector('.card-brand-chip')?.style?.backgroundColor;
      const barColor = el.querySelector('.card-bar-fill')?.style?.backgroundColor;
      const isGrayClass = el.classList.contains('card-completed-gray');
      const isCompletePill = el.querySelector('.card-status-pill')?.innerText?.trim();
      return { title, chipColor, barColor, isGrayClass, isCompletePill };
    });
  });

  console.log('RENDERED_CARDS:', JSON.stringify(cardItems, null, 2));

  // Take screenshot of cards breakdown section
  const sectionEl = await page.$('.card-performance-panel');
  if (sectionEl) {
    const screenshotPath = path.resolve(__dirname, 'cards_breakdown_screenshot.png');
    await sectionEl.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);
  }

  await browser.close();
})();
