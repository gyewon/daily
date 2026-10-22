import requests, json, sys, re

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://jkuuwmuniuvijvbtvwde.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE'
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}
resp = requests.get(f'{SUPABASE_URL}/rest/v1/app_settings?key=eq.records&select=value', headers=headers)
records = resp.json()[0]['value']

inst_records = [r for r in records if r.get('isInstallment') == 'Y' and not r.get('isCanceled') and (r.get('amount') or 0) > 0]
inst_records.sort(key=lambda x: x.get('date', ''))

tracking_map = {}

for r in inst_records:
    memo = r.get('memo') or ''
    if '정산' in memo or '더치페이' in memo:
        continue
    
    current_idx = 1
    total_idx = 3
    memo_matched = False
    
    m = re.search(r'(.*?)(\d+)\s*/\s*(\d+)(.*)', memo)
    if m:
        current_idx = int(m.group(2))
        total_idx = int(m.group(3))
        memo_matched = True
    else:
        mon_m = re.search(r'(\d+)\s*개월', memo) or (re.search(r'(\d+)\s*개월', r.get('installment') or ''))
        if mon_m:
            total_idx = int(mon_m.group(1))
            
    # Key in app.js:
    key = f"{r.get('merchant', '').strip()}_{total_idx}_{r.get('amount')}"
    
    if not memo_matched and key in tracking_map:
        current_idx = min(total_idx, tracking_map[key]['currentIdx'] + 1)
        
    if key not in tracking_map or current_idx > tracking_map[key]['currentIdx'] or (current_idx == tracking_map[key]['currentIdx'] and r.get('date') > tracking_map[key]['lastDate']):
        tracking_map[key] = {
            'merchant': r.get('merchant'),
            'card': r.get('actualCard'),
            'amount': r.get('amount') or 0,
            'currentIdx': current_idx,
            'totalIdx': total_idx,
            'lastDate': r.get('date'),
            'memo': memo
        }

total_left = 0
active_items = []
completed_items = []

for k, item in tracking_map.items():
    months_left = item['totalIdx'] - item['currentIdx']
    left_amt = months_left * item['amount']
    if months_left > 0:
        total_left += left_amt
        active_items.append((item, months_left, left_amt))
    else:
        completed_items.append(item)

print(f"=== ACTIVE INSTALLMENTS ({len(active_items)}건) - 총 남은 할부 원금: {total_left:,d}원 ===")
for item, months_left, left_amt in sorted(active_items, key=lambda x: -x[2]):
    print(f"[{item['merchant']}] ({item['memo']}) | {item['card']} | {item['currentIdx']}/{item['totalIdx']}회 | 월 {item['amount']:,d}원 | 잔액: {left_amt:,d}원 ({months_left}개월 남음)")

print(f"\n=== COMPLETED ({len(completed_items)}건) ===")
for item in completed_items:
    print(f"[{item['merchant']}] ({item['memo']}) | {item['currentIdx']}/{item['totalIdx']}회 완납")
