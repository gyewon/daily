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

  // 1. Switch to Annual Tab
  await page.click('#tabAnnualView');
  await new Promise(r => setTimeout(r, 1500));

  // Inspect the first 10 rows in tbody
  const rowOrder = await page.$$eval('#annualMatrixBody tr', rows => {
    return rows.slice(0, 10).map(r => {
      const isSub = r.classList.contains('row-subtotal');
      const isCard = r.classList.contains('row-card-item');
      const firstCell = r.querySelector('td.sticky-col')?.innerText?.trim();
      const display = window.getComputedStyle(r).display;
      return { isSub, isCard, firstCell, display };
    });
  });

  console.log('ANNUAL_ROW_ORDER (First 10 rows):', JSON.stringify(rowOrder, null, 2));

  // Take screenshot of annual table (expanded)
  const tablePanel = await page.$('.annual-matrix-panel');
  if (tablePanel) {
    const screenshotPath = path.resolve(__dirname, 'annual_matrix_expanded.png');
    await tablePanel.screenshot({ path: screenshotPath });
    console.log('Saved expanded screenshot to:', screenshotPath);
  }

  // 2. Click the first group header to collapse '💳 실물 카드'
  await page.click('#annualMatrixBody .row-group-header');
  await new Promise(r => setTimeout(r, 800));

  const collapsedRowOrder = await page.$$eval('#annualMatrixBody tr', rows => {
    return rows.slice(0, 10).map(r => {
      const isSub = r.classList.contains('row-subtotal');
      const isCard = r.classList.contains('row-card-item');
      const firstCell = r.querySelector('td.sticky-col')?.innerText?.trim();
      const display = r.style.display;
      return { isSub, isCard, firstCell, display };
    });
  });

  console.log('COLLAPSED_ROW_ORDER (After clicking group header):', JSON.stringify(collapsedRowOrder, null, 2));

  if (tablePanel) {
    const collapsedScreenshotPath = path.resolve(__dirname, 'annual_matrix_collapsed_one.png');
    await tablePanel.screenshot({ path: collapsedScreenshotPath });
    console.log('Saved collapsed one screenshot to:', collapsedScreenshotPath);
  }

  // 3. Click '전체 접기' button
  await page.click('#btnToggleAllAnnualGroups');
  await new Promise(r => setTimeout(r, 800));

  if (tablePanel) {
    const allCollapsedScreenshotPath = path.resolve(__dirname, 'annual_matrix_all_collapsed.png');
    await tablePanel.screenshot({ path: allCollapsedScreenshotPath });
    console.log('Saved all collapsed screenshot to:', allCollapsedScreenshotPath);
  }

  await browser.close();
})();
