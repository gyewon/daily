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
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('https://gyewon.github.io/daily/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Check Page 4
  const page4Data = await page.evaluate(() => {
    // Find page 4 button or click next
    const btns = Array.from(document.querySelectorAll('.page-btn'));
    const p4Btn = btns.find(b => b.textContent.trim() === '4');
    if (p4Btn) p4Btn.click();
    
    const rows = Array.from(document.querySelectorAll('#txTableBody tr')).map(r => r.innerText.replace(/\s+/g, ' '));
    return {
      clickedP4: !!p4Btn,
      rowCount: rows.length,
      rows: rows
    };
  });

  console.log('PAGE 4 DATA:\n', JSON.stringify(page4Data, null, 2));

  await browser.close();
})();
