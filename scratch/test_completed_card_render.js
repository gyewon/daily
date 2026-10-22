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
  await new Promise(r => setTimeout(r, 4000));

  // Programmatically mark all records of '국민카드_KB국민플래티늄카드' (which only has 1 record) as exclude='Y' in memory and re-render
  const result = await page.evaluate(() => {
    // Check appState
    const targetCard = '국민카드_KB국민플래티늄카드';
    window.appState.records.forEach(r => {
      if (r.actualCard === targetCard) {
        r.exclude = 'Y';
      }
    });
    // Trigger renderCardsBreakdown
    window.renderCardsBreakdown?.() || (function() {
      // Find and call if not exposed or simulate
    })();

    // Check DOM for targetCard
    const cardEls = Array.from(document.querySelectorAll('#physicalCardsContainer .card-item'));
    const targetEl = cardEls.find(el => el.querySelector('.card-title')?.innerText?.trim() === targetCard);
    if (!targetEl) return { found: false };

    return {
      found: true,
      title: targetCard,
      chipColor: targetEl.querySelector('.card-brand-chip')?.style?.backgroundColor,
      barColor: targetEl.querySelector('.card-bar-fill')?.style?.backgroundColor,
      isGrayClass: targetEl.classList.contains('card-completed-gray'),
      pillText: targetEl.querySelector('.card-status-pill')?.innerText?.trim()
    };
  });

  console.log('COMPLETED_CARD_TEST_RESULT:', JSON.stringify(result, null, 2));

  // Take screenshot of panel
  const sectionEl = await page.$('.card-performance-panel');
  if (sectionEl) {
    const screenshotPath = path.resolve(__dirname, 'completed_card_screenshot.png');
    await sectionEl.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);
  }

  await browser.close();
})();
