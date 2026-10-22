import os
import sys
import json
import pyzipper
import openpyxl
import datetime
import urllib.request
import re

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load the Excel from zip
out_excel = 'd:/AI App/daily/scratch/extracted_current/current_upload.xlsx'
wb = openpyxl.load_workbook(out_excel, data_only=True)
ws = wb['가계부 내역'] if '가계부 내역' in wb.sheetnames else wb.active
rows = list(ws.iter_rows(values_only=True))

headerRow = rows[0]
headerFlat = '|'.join([str(h or '').replace(' ', '') for h in headerRow])

def find_col(keywords, default_idx):
    for i, h in enumerate(headerRow):
        hs = str(h or '').replace(' ', '')
        if any(k in hs for k in keywords):
            return i
    return default_idx

col_date = find_col(['날짜', '거래일시', '일시'], 0)
col_time = find_col(['시간'], 1)
col_type = find_col(['타입', '구분', '수입/지출'], 2)
col_cat = find_col(['대분류', '카테고리'], 3)
col_sub = find_col(['소분류'], 4)
col_merchant = find_col(['내용', '가맹점', '사용처', '항목'], 5)
col_amt = find_col(['금액', '지출', 'amount', '결제금액'], 6)
col_pay = find_col(['결제수단', '카드', '결제방법'], 8)
col_memo = find_col(['메모', '비고'], 9)

parsed_list = []
for r_idx in range(1, len(rows)):
    row = rows[r_idx]
    if not row or not any(row):
        continue
    if row[0] in ('총 합 계', '합계'):
        continue
    
    t = str(row[col_type] or '').strip() if col_type != -1 else ''
    if t and '수입' in t:
        continue
        
    raw_amt = row[col_amt]
    if raw_amt is None or raw_amt == '':
        continue
        
    num_str = re.sub(r'[^0-9.-]', '', str(raw_amt))
    try:
        amount = -int(float(num_str))
    except:
        continue
    if amount == 0:
        continue
        
    # Date
    date_raw = row[col_date]
    time_raw = row[col_time] if col_time != -1 else None
    
    if isinstance(date_raw, (datetime.date, datetime.datetime)):
        date_str = date_raw.strftime('%Y-%m-%d')
    else:
        date_str = str(date_raw or '').strip().split(' ')[0].replace('.', '-')
        
    if isinstance(time_raw, datetime.time):
        time_str = time_raw.strftime('%H:%M:%S')
    elif isinstance(time_raw, (int, float)):
        total_seconds = round(float(time_raw) * 86400)
        h = str(total_seconds // 3600).zfill(2)
        m = str((total_seconds % 3600) // 60).zfill(2)
        s = str(total_seconds % 60).zfill(2)
        time_str = f"{h}:{m}:{s}"
    else:
        time_str = str(time_raw or '00:00:00').strip()
        if len(time_str) == 5:
            time_str += ':00'
            
    merchant = str(row[col_merchant] or '').strip()
    orig_pay = str(row[col_pay] or '기타 카드').strip()
    memo = str(row[col_memo] or '').strip() if col_memo != -1 else ''
    
    parsed_list.append({
        'date': date_str,
        'time': time_str,
        'merchant': merchant,
        'amount': amount,
        'origPay': orig_pay,
        'actualCard': orig_pay,
        'category': str(row[col_cat] or '기타').strip() if col_cat != -1 else '',
        'subCategory': str(row[col_sub] or '').strip() if col_sub != -1 else '',
        'memo': memo,
        'row': r_idx + 1
    })

print(f"Total parsed expenditure rows from Excel: {len(parsed_list)}")

# 2. Get Supabase records and deleted_signatures
url_recs = 'https://jkuuwmuniuvijvbtvwde.supabase.co/rest/v1/app_settings?key=eq.records&select=*'
url_del = 'https://jkuuwmuniuvijvbtvwde.supabase.co/rest/v1/app_settings?key=eq.deleted_signatures&select=*'
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE'
}

req = urllib.request.Request(url_recs, headers=headers)
with urllib.request.urlopen(req) as resp:
    curr_records = json.loads(resp.read().decode('utf-8'))[0]['value']

req2 = urllib.request.Request(url_del, headers=headers)
with urllib.request.urlopen(req2) as resp:
    deleted_sigs = set(json.loads(resp.read().decode('utf-8'))[0]['value'])

def get_sig(r):
    return f"{r.get('date')}|{r.get('time') or ''}|{r.get('merchant')}|{r.get('amount')}"

# Note: In app.js:
# First filter: pendingUploadedRecords = pendingUploadedRecords.filter(r => selectedMethods.includes(r.actualCard) && (pendingUploadMode === 'backup' || !appState.deletedSignatures.has(getSignature(r))));
# Let's see which records matched deletedSignatures BEFORE hedging:
# The 2 deleted signatures added during hedging were:
# 2026-10-21|17:27:03|쿠팡|-7150
# 2026-10-21|17:25:43|쿠팡|7150 (or 17:27:03)
# Let's inspect all items in parsed_list that have amount < 0 or amount == 7150
print("\n--- Rows with amount == 7150 or amount == -7150 or negative in parsed_list ---")
for p in parsed_list:
    if p['amount'] < 0 or abs(p['amount']) == 7150:
        print(f"Row {p['row']}: {get_sig(p)} | {p['origPay']} | {p['category']}")

# Let's simulate:
# Existing signatures before this upload:
# We know currently curr_records has 233 records.
# Let's check which records in parsed_list exist in curr_records and which were newly added!
curr_sigs = set(get_sig(r) for r in curr_records)

in_curr = []
not_in_curr = []

for p in parsed_list:
    sig = get_sig(p)
    if sig in curr_sigs:
        in_curr.append(p)
    else:
        not_in_curr.append(p)

print(f"\nIn current records: {len(in_curr)}")
print(f"Not in current records: {len(not_in_curr)}")
for p in not_in_curr:
    print(f"NOT IN CURR: {get_sig(p)} | {p['origPay']}")

# Also let's check which records in curr_records are on 2026-10-22
print("\n--- All records on 2026-10-22 in current Supabase records ---")
for r in curr_records:
    if r.get('date') == '2026-10-22':
        print(f"ID {r.get('id')}: {get_sig(r)} | card: {r.get('actualCard')} (orig: {r.get('origPay')}) | cat: {r.get('category')}/{r.get('subCategory')} | inst: {r.get('isInstallment')}")
