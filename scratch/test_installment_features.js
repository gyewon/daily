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
    defaultViewport: { width: 1787, height: 1084 }
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.toString()));
  
  await page.goto('file:///D:/AI%20App/daily/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 3000));
  
  // 1. Check initial sort (payoff - fewest months left first)
  const payoffTitles = await page.$$eval('.inst-card .inst-merchant-title', els => els.map(el => el.textContent.trim()));
  const payoffMonths = await page.$$eval('.inst-card .inst-left-months-pill', els => els.map(el => el.textContent.trim()));
  console.log('--- Initial Sort (완납 임박순 / 먼저 끝나는 순) ---');
  payoffTitles.forEach((t, i) => console.log(`  ${i+1}. ${t} (${payoffMonths[i]})`));

  // 2. Click [최초 결제일순]
  await page.click('button[data-sort="firstDate"]');
  await new Promise(r => setTimeout(r, 500));
  const dateTitles = await page.$$eval('.inst-card .inst-merchant-title', els => els.map(el => el.textContent.trim()));
  const dateSub = await page.$$eval('.inst-card .inst-last-date', els => els.map(el => el.textContent.trim()));
  console.log('--- FirstDate Sort (최초 결제일순 / 먼저 끊은 날짜) ---');
  dateTitles.forEach((t, i) => console.log(`  ${i+1}. ${t} (${dateSub[i]})`));

  // 3. Test toggling row 214 to N
  console.log('--- Testing inst-toggle-btn on row 214 ---');
  const btn214Before = await page.$eval('button.inst-toggle-btn[data-id="214"]', el => el.textContent.trim());
  console.log('Row 214 button text before click:', btn214Before);
  
  await page.click('button.inst-toggle-btn[data-id="214"]');
  await new Promise(r => setTimeout(r, 1000));
  
  const btn214After = await page.$eval('button.inst-toggle-btn[data-id="214"]', el => el.textContent.trim());
  const memo214After = await page.$eval('input.input-table-memo[data-id="214"]', el => el.value);
  console.log('Row 214 button text after click:', btn214After);
  console.log('Row 214 memo after click:', memo214After);

  // 4. Test "할부 자동 연결" detection
  console.log('--- Testing 할부 자동 연결 modal ---');
  await page.click('#btnAutoInstallment');
  await new Promise(r => setTimeout(r, 600));
  await page.click('#btnDetectInstallments');
  await new Promise(r => setTimeout(r, 600));
  
  const syncPreviewText = await page.$eval('#instSyncPreviewArea', el => el.innerText.replace(/\s+/g, ' '));
  console.log('Sync preview output:', syncPreviewText.substring(0, 300));
  
  // 5. Test applying the sync!
  // Dialog handler for confirm
  page.on('dialog', async dialog => {
    console.log('Dialog opened:', dialog.message());
    await dialog.accept();
  });
  
  const btnApply = await page.$('#btnApplyInstSync');
  if (btnApply) {
    await btnApply.click();
    await new Promise(r => setTimeout(r, 1000));
    const btn214Reconnected = await page.$eval('button.inst-toggle-btn[data-id="214"]', el => el.textContent.trim());
    const memo214Reconnected = await page.$eval('input.input-table-memo[data-id="214"]', el => el.value);
    console.log('After Auto-Link Apply -> Button 214:', btn214Reconnected, '| Memo:', memo214Reconnected);
  }

  await browser.close();
})();
