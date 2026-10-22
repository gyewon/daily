const puppeteer = require('puppeteer-core');
const fs = require('fs');

const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

let executablePath = edgePaths.find(p => fs.existsSync(p));

(async () => {
  console.log('Using browser at:', executablePath);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  console.log('Navigating to https://gyewon.github.io/daily/ ...');
  await page.goto('https://gyewon.github.io/daily/', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait 4 seconds for loadData background sync
  await new Promise(r => setTimeout(r, 4000));

  const result = await page.evaluate(() => {
    // Check if appState is exposed or inside IIFE
    const countBadge = document.getElementById('filteredCountBadge')?.textContent;
    const tableRows = Array.from(document.querySelectorAll('#txTableBody tr'));
    const rowData = tableRows.map(r => r.innerText.replace(/\s+/g, ' '));
    const globalMonth = document.getElementById('globalMonthFilter')?.value;
    const cache = localStorage.getItem('gyewon_appState_cache');
    let cacheCount = 0;
    let latestCacheRecord = null;
    if (cache) {
      try {
        const p = JSON.parse(cache);
        cacheCount = p.records ? p.records.length : 0;
        latestCacheRecord = p.records ? p.records[p.records.length - 1] : null;
      } catch(e) {}
    }

    return {
      countBadge,
      tableRowCount: tableRows.length,
      globalMonth,
      firstRow: rowData[0],
      lastRowOnCurrentPage: rowData[rowData.length - 1],
      allRows: rowData.slice(-5),
      cacheCount,
      latestCacheRecord
    };
  });

  console.log('RESULT:\n', JSON.stringify(result, null, 2));

  await browser.close();
})();
