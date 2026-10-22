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

  // 1. Select '전체 월 보기' (value='ALL')
  await page.select('#globalMonthFilter', 'ALL');
  await new Promise(r => setTimeout(r, 1500));

  const allMonthCards = await page.$$eval('#physicalCardsContainer .card-item', items => {
    return items.map(el => {
      return {
        title: el.querySelector('.card-title')?.innerText?.trim(),
        amount: el.querySelector('.card-amount')?.innerText?.trim(),
        hasTargetBadge: !!el.querySelector('.card-target-badge'),
        hasInstPerfNote: !!el.querySelector('.card-inst-note'),
        sublineText: el.querySelector('.card-extra-subline')?.innerText?.trim() || null
      };
    });
  });

  console.log('ALL_MONTH_CARDS:', JSON.stringify(allMonthCards, null, 2));

  // Screenshot left panel in ALL month mode
  const sectionEl = await page.$('.card-performance-panel');
  if (sectionEl) {
    const screenshotPath = path.resolve(__dirname, 'all_month_cards_screenshot.png');
    await sectionEl.screenshot({ path: screenshotPath });
    console.log('Saved ALL month screenshot to:', screenshotPath);
  }

  // 2. Select back to '10월'
  const hasOct = await page.$eval('#globalMonthFilter', select => {
    const opt = Array.from(select.options).find(o => o.value.includes('10'));
    return opt ? opt.value : null;
  });
  if (hasOct) {
    await page.select('#globalMonthFilter', hasOct);
    await new Promise(r => setTimeout(r, 1500));

    const octMonthCards = await page.$$eval('#physicalCardsContainer .card-item', items => {
      return items.map(el => {
        return {
          title: el.querySelector('.card-title')?.innerText?.trim(),
          amount: el.querySelector('.card-amount')?.innerText?.trim(),
          hasTargetBadge: !!el.querySelector('.card-target-badge'),
          hasInstPerfNote: !!el.querySelector('.card-inst-note')
        };
      });
    });

    console.log('OCT_MONTH_CARDS (showing target/perf):', JSON.stringify(octMonthCards, null, 2));
  }

  await browser.close();
})();
