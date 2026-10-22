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
  
  const panel = await page.$('#installmentTrackerPanel');
  if (panel) {
    const box = await panel.boundingBox();
    console.log('Installment Panel BoundingBox:', box);
    
    // Screenshot just the installment panel with some padding
    await panel.screenshot({
      path: 'scratch/installment_panel_screenshot.png'
    });
    console.log('Saved scratch/installment_panel_screenshot.png');
  } else {
    console.log('Panel not found!');
  }
  
  // Also full page screenshot around the panel
  await page.screenshot({
    path: 'scratch/full_page_screenshot.png',
    clip: { x: 0, y: 700, width: 1787, height: 800 }
  });
  console.log('Saved scratch/full_page_screenshot.png');
  
  await browser.close();
})();
