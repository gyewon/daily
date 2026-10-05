const XLSX = require('xlsx');

// 1. Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws_data = [
  ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모'],
  ['2026-09-29', '21:15', '지출', '미분류', '미분류', 'Airbnb', -813074, 'KRW', '롯데카드_스카이패스', '']
];
const ws = XLSX.utils.aoa_to_sheet(ws_data);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'test_upload.xlsx');
