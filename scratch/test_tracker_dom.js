const puppeteer = require('puppeteer-core');
const fs = require('fs');

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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
  });
  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.toString());
    errors.push(err.toString());
  });

  // Start python server in background or test gyewon.github.io
  await page.goto('http://localhost:8089/index.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const data = await page.evaluate(() => {
    const totalInstallmentLeft = document.getElementById('kpiTotalInstallmentLeft')?.textContent;
    const installmentCount = document.getElementById('kpiInstallmentCount')?.textContent;
    const items = Array.from(document.querySelectorAll('#installmentTrackingList li')).map(li => li.innerText.replace(/\s+/g, ' '));

    return {
      totalInstallmentLeft,
      installmentCount,
      items
    };
  });

  console.log('Installment Tracker Data:\n', JSON.stringify(data, null, 2));

  await browser.close();
  process.exit(0);
})();
