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
  await page.goto('https://gyewon.github.io/daily/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const page3Data = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.page-btn'));
    const p3Btn = btns.find(b => b.textContent.trim() === '3');
    if (p3Btn) p3Btn.click();
    
    const rows = Array.from(document.querySelectorAll('#txTableBody tr')).map(r => r.innerText.replace(/\s+/g, ' '));
    return {
      rowCount: rows.length,
      first5: rows.slice(0, 5),
      last5: rows.slice(-5)
    };
  });

  console.log('PAGE 3 DATA:\n', JSON.stringify(page3Data, null, 2));

  await browser.close();
})();
