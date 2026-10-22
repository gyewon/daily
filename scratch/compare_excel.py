import sys
import os
import openpyxl
import requests
import json

SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

resp = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?select=*", headers=SUPABASE_HEADERS)
data = resp.json()
settings = {item.get('key'): item.get('value') for item in data}

recs = settings.get('records', [])
print(f"Total existing records: {len(recs)}")

excel_path = 'scratch/extracted_excel/banksalad_1792597472.xlsx'
wb = openpyxl.load_workbook(excel_path)
sheet = wb.worksheets[1]
rows = list(sheet.iter_rows(values_only=True))
print(f"Excel total rows: {len(rows)}")

CARD_MAP = {
    '신한은행 The More': '신한카드_더모아',
    '신한 The More': '신한카드_더모아',
    '더모아': '신한카드_더모아',
    'KT Plus 우리카드': '우리카드_KT Plus',
    '우리카드 KT Plus': '우리카드_KT Plus',
    'MG+ S 하나카드': '하나카드_MG+ S',
    '하나카드 MG+ S': '하나카드_MG+ S',
    'KB국민 톡톡 my point카드': '국민카드_톡마포',
    '톡톡 my point': '국민카드_톡마포',
    '톡마포': '국민카드_톡마포',
    '다드림 LOVE': '신한카드_다드림 LOVE',
    '신한 복지 다드림 LOVE': '신한카드_다드림 LOVE',
    '신한카드_다드림 LOVE': '신한카드_다드림 LOVE',
    '아시아나 KB국민플래티늄카드': '국민카드_KB국민플래티늄카드',
    'KB국민플래티늄카드': '국민카드_KB국민플래티늄카드',
    '국민카드_KB국민플래티늄카드': '국민카드_KB국민플래티늄카드',
    '현대카드_제로에디션': '현대카드_제로에디션',
    '현대카드 ZERO': '현대카드_제로에디션',
    '네이버페이 간편결제': '네이버페이 간편결제',
    '네이버페이 간편결제(포인트)': '네이버페이 간편결제(포인트)',
}

parsed = []
for vals in rows[1:]:
    if not any(vals):
        continue
    record_type = str(vals[2] or '').strip()
    if record_type != '지출':
        continue
    d_raw = str(vals[0] or '').split(' ')[0].strip()
    tm_raw = str(vals[1] or '').strip()
    cat = str(vals[3] or '기타').strip()
    sub = str(vals[4] or '').strip()
    merchant = str(vals[5] or '').strip()
    try:
        amt = abs(int(float(vals[6] or 0)))
    except:
        amt = 0
    orig_pay = str(vals[8] or '기타').strip() if len(vals) > 8 else '기타'
    memo = str(vals[9] or '').strip() if len(vals) > 9 else ''
    if not d_raw or amt == 0:
        continue
    actual_card = CARD_MAP.get(orig_pay, orig_pay)
    if '입출금' in orig_pay or '통장' in orig_pay:
        actual_card = '계좌/현금'
    m_str = f"{int(d_raw.split('-')[1])}월" if '-' in d_raw and len(d_raw.split('-')) > 1 else '9월'
    sig = f"{d_raw}|{tm_raw}|{merchant}|{amt}"
    fuzzy = f"{d_raw}|{merchant}|{amt}"
    parsed.append({
        'date': d_raw,
        'time': tm_raw,
        'month': m_str,
        'category': cat,
        'subCategory': sub,
        'merchant': merchant,
        'amount': amt,
        'origPay': orig_pay,
        'actualCard': actual_card,
        'isInstallment': 'N',
        'installment': '일시불',
        'billingAmount': amt,
        'exclude': 'N',
        'memo': memo,
        'originalSignature': sig,
        '_fuzzy_sig': fuzzy
    })

print(f"Total parsed expense records from excel: {len(parsed)}")

existing_sigs = {r.get('originalSignature') for r in recs}
existing_fuzzy = {f"{r.get('date')}|{r.get('merchant')}|{r.get('amount')}" for r in recs}
deleted_sigs = set(settings.get('deleted_signatures', []))

unmatched = []
for p in parsed:
    sig = p['originalSignature']
    fuzzy = p['_fuzzy_sig']
    if sig in deleted_sigs:
        continue
    if sig in existing_sigs or fuzzy in existing_fuzzy:
        continue
    unmatched.append(p)

print(f"Unmatched (new) records: {len(unmatched)}")
for u in unmatched:
    print(f"{u['date']} {u['time']} | {u['merchant']} | {u['amount']}원 | {u['actualCard']}")
