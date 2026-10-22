const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://gyewon.github.io/daily/', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const result = await page.evaluate(() => {
    const kpiLeft = document.getElementById('kpiTotalInstallmentLeft')?.textContent;
    const kpiCount = document.getElementById('kpiInstallmentCount')?.textContent;
    const panelDisplay = document.getElementById('installmentTrackerPanel')?.style.display;
    const lis = Array.from(document.querySelectorAll('#installmentTrackingList li')).map(li => li.innerText.replace(/\n+/g, ' | '));
    return { kpiLeft, kpiCount, panelDisplay, lis };
  });
  
  console.log('Panel display:', result.panelDisplay);
  console.log('KPI Left:', result.kpiLeft);
  console.log('KPI Count:', result.kpiCount);
  console.log('Items (' + result.lis.length + '):\n' + result.lis.join('\n'));
  
  await browser.close();
})();
