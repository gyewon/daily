const XLSX = require('xlsx');
function parse(file) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
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
  };
  
  console.log('Columns:', col);
  console.log('Header Row:', headerRowIdx, rows[headerRowIdx]);

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if(row && row.some(c => String(c).includes('813074') || String(c).includes('Airbnb'))) {
      console.log('Found Airbnb Row:', row);
      console.log('rawAmt:', row[col.amt]);
    }
  }
}
parse('C:/Users/js011/Downloads/허계원님_2026-09-01~2026-10-04/2026-09-01~2026-10-04.xlsx');
