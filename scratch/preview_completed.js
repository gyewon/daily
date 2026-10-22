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
  await new Promise(r => setTimeout(r, 3000));

  // Simulate a completed card visually by applying the exact classes/styles generated when isComplete is true
  await page.evaluate(() => {
    const cardEl = document.querySelectorAll('#physicalCardsContainer .card-item')[0]; // 하나카드_MG+ S
    if (cardEl) {
      cardEl.classList.add('card-completed-gray');
      const chip = cardEl.querySelector('.card-brand-chip');
      if (chip) chip.style.background = '#64748b';
      const bar = cardEl.querySelector('.card-bar-fill');
      if (bar) {
        bar.style.background = '#64748b';
        bar.style.width = '100%';
      }
      const pill = cardEl.querySelector('.card-status-pill');
      if (pill) {
        pill.className = 'card-status-pill completed';
        pill.innerText = '✅ 완료';
      }
      const amtEl = cardEl.querySelector('.card-complete-amt');
      if (amtEl) amtEl.innerText = '1,034,447원';
    }
  });

  const sectionEl = await page.$('.card-performance-panel');
  if (sectionEl) {
    const screenshotPath = path.resolve(__dirname, 'preview_completed_card.png');
    await sectionEl.screenshot({ path: screenshotPath });
    console.log('Saved preview to:', screenshotPath);
  }

  await browser.close();
})();
