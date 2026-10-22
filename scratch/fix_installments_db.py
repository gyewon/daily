import json, sys, requests

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

# 1. Fetch current records from Supabase
resp = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.records&select=value", headers=headers)
records = resp.json()[0]['value']
print(f"Total records fetched from Supabase: {len(records)}")

# 2. Modify target records
updated_count = 0
for r in records:
    rid = r.get('id')
    
    # 1. 의자 할부 2회차 (ID 125, 2026-10-02 인터넷상거래 120,666원)
    if rid == 125 or (r.get('date') == '2026-10-02' and r.get('merchant') == '인터넷상거래' and r.get('amount') == 120666):
        print(f"Updating ID {rid} (인터넷상거래): memo -> '의자 할부(2/3)', isInstallment -> 'Y'")
        r['memo'] = '의자 할부(2/3)'
        r['isInstallment'] = 'Y'
        updated_count += 1
        
    # 2. 유앤아이의원 할부 2회차 (ID 136, 2026-10-04 유앤아이의원 107,500원)
    elif rid == 136 or (r.get('date') == '2026-10-04' and r.get('merchant') == '유앤아이의원' and r.get('amount') == 107500):
        print(f"Updating ID {rid} (유앤아이의원): memo -> '할부 (2/3)', isInstallment -> 'Y'")
        r['memo'] = '할부 (2/3)'
        r['isInstallment'] = 'Y'
        updated_count += 1

    # 3. 동욱면접 할부 4회차 (ID 144, 2026-10-06 하나카드 주식회사 138,000원)
    elif rid == 144 or (r.get('date') == '2026-10-06' and '하나카드' in r.get('merchant', '') and r.get('amount') == 138000):
        print(f"Updating ID {rid} (동욱면접 하나카드): card -> '하나카드_MG+ S', memo -> '동욱면접 할부(4/5)', isInstallment -> 'Y'")
        r['actualCard'] = '하나카드_MG+ S'
        r['memo'] = '동욱면접 할부(4/5)'
        r['isInstallment'] = 'Y'
        updated_count += 1

    # 4. 마키노차야 할부 2회차 (ID 215, 2026-10-22 마키노차야 해운대엘시티점 154,800원)
    elif rid == 215 or (r.get('date') == '2026-10-22' and '마키노차야' in r.get('merchant', '') and r.get('amount') == 154800):
        print(f"Updating ID {rid} (마키노차야): card -> '신한카드_다드림 LOVE', memo -> '할부 (2/3)', isInstallment -> 'Y'")
        r['actualCard'] = '신한카드_다드림 LOVE'
        r['memo'] = '할부 (2/3)'
        r['isInstallment'] = 'Y'
        updated_count += 1

    # 5. 선글라스 할부 1회차 (ID 133, 2026-10-03 신세계면세점 96,078원)
    elif rid == 133 or (r.get('date') == '2026-10-03' and '신세계면세점' in r.get('merchant', '') and r.get('amount') == 96078):
        print(f"Updating ID {rid} (신세계면세점 선글라스): isInstallment -> 'Y'")
        r['isInstallment'] = 'Y'
        updated_count += 1

print(f"\nTotal records modified: {updated_count}")

# 3. Save back to Supabase
save_resp = requests.post(f"{SUPABASE_URL}/rest/v1/app_settings", headers=headers, json=[{"key": "records", "value": records}])
print(f"Save to Supabase status: {save_resp.status_code}")

# 4. Also update local current_supabase_records.json
with open('scratch/current_supabase_records.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)
print("Updated scratch/current_supabase_records.json")
