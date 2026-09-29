const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('file:///' + path.resolve('index.html'));
  await new Promise(r => setTimeout(r, 1000));
  
  const inputUploadHandle = await page.$('#excelFileInput');
  await inputUploadHandle.uploadFile(path.resolve('test.xlsx'));
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Clicking btnUploadAppend...');
  await page.click('#btnUploadAppend');
  
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
