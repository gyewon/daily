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
  
  await page.goto('file:///D:/AI%20App/daily/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 3500));

  const cardDetails = await page.$$eval('#physicalCardsContainer .card-item', items => {
    return items.map(el => {
      const titleEl = el.querySelector('.card-title');
      const amountEl = el.querySelector('.card-amount');
      const pillEl = el.querySelector('.card-status-pill');
      const sublineEl = el.querySelector('.card-extra-subline');
      const rect = el.getBoundingClientRect();
      const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;

      return {
        cardWidth: rect.width,
        title: titleEl?.innerText?.trim(),
        titleWidth: titleRect ? titleRect.width : 0,
        amount: amountEl?.innerText?.trim(),
        pill: pillEl?.innerText?.trim() || null,
        subline: sublineEl?.innerText?.trim() || null
      };
    });
  });

  console.log('CARDS_DETAILS:', JSON.stringify(cardDetails, null, 2));

  // Screenshot left panel
  const sectionEl = await page.$('.card-performance-panel');
  if (sectionEl) {
    const screenshotPath = path.resolve(__dirname, 'cards_fixed_screenshot.png');
    await sectionEl.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);
  }

  // Also screenshot the full split layout to see both panels side-by-side
  const splitLayoutEl = await page.$('.dashboard-split-layout');
  if (splitLayoutEl) {
    const splitScreenshotPath = path.resolve(__dirname, 'split_layout_fixed_screenshot.png');
    await splitLayoutEl.screenshot({ path: splitScreenshotPath });
    console.log('Saved split layout screenshot to:', splitScreenshotPath);
  }

  await browser.close();
})();
