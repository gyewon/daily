const puppeteer = require('puppeteer-core');
const fs = require('fs');
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
let executablePath = edgePaths.find(p => fs.existsSync(p));

(async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.goto('file:///D:/AI%20App/daily/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 3000));
  
  // Filter by '포헤어'
  await page.type('#searchInput', '포헤어');
  await new Promise(r => setTimeout(r, 800));
  
  const btn214Before = await page.evaluate(() => {
    return document.querySelector('button.inst-toggle-btn[data-id="214"]')?.textContent?.trim();
  });
  console.log('Button 214 before click:', btn214Before);
  
  // Click toggle
  await page.click('button.inst-toggle-btn[data-id="214"]');
  await new Promise(r => setTimeout(r, 1000));
  
  const stateAfter = await page.evaluate(() => {
    const btn = document.querySelector('button.inst-toggle-btn[data-id="214"]')?.textContent?.trim();
    const memo = document.querySelector('input.input-table-memo[data-id="214"]')?.value;
    return { btn, memo };
  });
  console.log('Button 214 after click:', stateAfter.btn, '| Memo:', stateAfter.memo);
  
  // Open auto installment modal
  await page.click('#btnAutoInstallment');
  await new Promise(r => setTimeout(r, 600));
  await page.click('#btnDetectInstallments');
  await new Promise(r => setTimeout(r, 600));
  
  const syncPreviewText = await page.evaluate(() => {
    return document.getElementById('instSyncPreviewArea')?.innerText?.replace(/\s+/g, ' ');
  });
  console.log('Auto Installment Sync Detection:\n', syncPreviewText);
  
  await browser.close();
})();
