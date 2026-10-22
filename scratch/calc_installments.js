const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';

async function check() {
  const resp = await fetch(supabaseUrl + '/rest/v1/app_settings?select=*', {
    headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
  });
  const data = await resp.json();
  const recs = data.find(d => d.key === 'records').value;
  
  const installmentRecords = recs.filter(r => r.isInstallment === 'Y' && !r.isCanceled && (Number(r.amount) || 0) > 0);
  
  const trackingMap = {};
  const sortedInstRecords = [...installmentRecords].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  sortedInstRecords.forEach(r => {
    const memo = r.memo || '';
    if (memo.includes('정산') || memo.includes('더치페이')) return;
    
    let currentIdx = 1;
    let totalIdx = 3;
    let memoMatched = false;

    const match = memo.match(/(.*?)(\d+)\s*\/\s*(\d+)(.*)/);
    if (match) {
      currentIdx = parseInt(match[2], 10);
      totalIdx = parseInt(match[3], 10);
      memoMatched = true;
    } else {
      const monMatch = memo.match(/(\d+)\s*개월/) || (r.installment && r.installment.match(/(\d+)\s*개월/));
      if (monMatch) {
        totalIdx = parseInt(monMatch[1], 10);
      }
    }
    
    const key = `${r.merchant.trim()}_${totalIdx}_${r.amount}`;
    
    if (!memoMatched && trackingMap[key]) {
      currentIdx = Math.min(totalIdx, trackingMap[key].currentIdx + 1);
    }
    
    if (!trackingMap[key] || currentIdx > trackingMap[key].currentIdx || (currentIdx === trackingMap[key].currentIdx && new Date(r.date) > new Date(trackingMap[key].lastDate))) {
      const preferredCard = (!r.actualCard || r.actualCard.includes('간편결제')) && trackingMap[key]?.card && !trackingMap[key].card.includes('간편결제') ? trackingMap[key].card : r.actualCard;
      trackingMap[key] = {
        merchant: r.merchant,
        card: preferredCard,
        amount: Number(r.amount) || 0,
        currentIdx: currentIdx,
        totalIdx: totalIdx,
        lastDate: r.date,
        memo: memo
      };
    }
  });

  let totalLeft = 0;
  console.log('--- TRACKING MAP ITEMS ---');
  for (const [key, item] of Object.entries(trackingMap)) {
    const monthsLeft = item.totalIdx - item.currentIdx;
    const leftAmt = monthsLeft * item.amount;
    if (monthsLeft > 0) {
      totalLeft += leftAmt;
      console.log(`[ACTIVE] ${item.merchant} | 월 ${item.amount}원 | 진행: ${item.currentIdx}/${item.totalIdx}회 | ${monthsLeft}개월 남음 | 잔여: ${leftAmt}원 | 최근청구: ${item.lastDate} | 메모: ${item.memo}`);
    } else {
      console.log(`[COMPLETED] ${item.merchant} | 월 ${item.amount}원 | 진행: ${item.currentIdx}/${item.totalIdx}회 | 완료됨`);
    }
  }
  console.log('--- TOTAL LEFT ---', totalLeft);
}
check();
