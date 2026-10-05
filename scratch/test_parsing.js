const XLSX = require('xlsx');
const wb = XLSX.readFile('test_upload.xlsx');
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

let headerRowIdx = 0;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const rowStr = (rows[i] || []).join(' ');
  if (['날짜', '금액', '내용', '가맹점', '결제수단', '분류', '거래일시'].some(k => rowStr.includes(k))) {
    headerRowIdx = i;
    break;
  }
}

const headerRow = rows[headerRowIdx] || [];
const findCol = (keywords, defaultIdx) => {
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || '').replace(/\s+/g, '');
    if (keywords.some(k => h.includes(k))) return i;
  }
  return defaultIdx;
};

const col = {
  date: findCol(['날짜', '거래일시', '일시'], 0),
  time: findCol(['시간'], 1),
  type: findCol(['타입', '구분', '수입/지출'], 2),
  cat: findCol(['대분류', '분류', '카테고리'], 3),
  sub: findCol(['소분류', '하위카테고리'], 4),
  merchant: findCol(['내용', '가맹점', '거래처'], 5),
  amt: findCol(['금액', '지출금액', '원화금액'], 6),
  pay: findCol(['실제결제카드', '결제수단', '원본결제수단'], 8),
  memo: findCol(['메모', '비고'], 9)
};

console.log('Columns:', col);

const parsedList = [];
for (let r = headerRowIdx + 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length === 0) continue;
  if (row[0] === '총 합 계' || row[0] === '합계') continue;

  let t = '';
  if (col.type !== -1) {
    t = String(row[col.type] || '').trim();
    if (t && t.includes('수입')) continue;
  }

  const rawAmt = row[col.amt];
  if (rawAmt === undefined || rawAmt === null || rawAmt === '') {
    console.log(`Row ${r}: rawAmt is empty (rawAmt=${rawAmt})`);
    continue;
  }
  const numStr = String(rawAmt).replace(/[^0-9.-]/g, '');
  const amount = -(Number(numStr) || 0);
  if (amount === 0) {
    console.log(`Row ${r}: amount is 0 (numStr=${numStr})`);
    continue;
  }

  let dateRaw = row[col.date];
  let timeRaw = row[col.time];
  let dateStr = "";
  let timeStr = "00:00:00";

  if (typeof dateRaw === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + dateRaw * 86400000);
    dateStr = parsed.toISOString().split("T")[0];
  } else {
    dateStr = String(dateRaw || "").trim();
    if (dateStr.length > 10 && dateStr.includes(" ")) {
      const parts = dateStr.split(" ");
      dateStr = parts[0];
      if (!timeRaw) timeRaw = parts[1];
    }
    dateStr = dateStr.slice(0, 10).replace(/\./g, "-");
  }

  if (typeof timeRaw === "number") {
    const totalSeconds = Math.round(timeRaw * 86400);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    timeStr = `${h}:${m}:${s}`;
  } else {
    timeStr = String(timeRaw || "00:00:00").trim();
    if (timeStr.length === 5) timeStr += ":00";
  }

  const origPay = String(row[col.pay] || '기타 카드').trim();
  let actualCard = origPay;
  
  const rawMerchant = String(row[col.merchant] || '').trim();
  const memoRaw = String(row[col.memo] || '').trim();

  parsedList.push({
    date: dateStr,
    time: timeStr,
    merchant: rawMerchant,
    amount: amount,
    actualCard: actualCard
  });
}

console.log('Parsed List:', parsedList);
