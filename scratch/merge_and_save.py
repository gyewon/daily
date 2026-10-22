import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests
import banksalad_sync

# 1. Load backup records (139 records: 9월 + 10월 4일까지)
with open('backups/backup_2026-10-05.json', 'r', encoding='utf-8') as f:
    b = json.load(f)

backup_recs = []
for item in b.get('app_settings', []):
    if item.get('key') == 'records':
        backup_recs = item.get('value', [])

# 2. Parse latest excel (89 records: 10월 4일 ~ 10월 22일까지)
excel_recs = banksalad_sync.parse_banksalad_excel('scratch/extracted_excel/banksalad_1792597472.xlsx')

combined = []
seen_sigs = set()

# Backup records first
for r in backup_recs:
    sig = r.get('originalSignature') or f"{r.get('date')}|{r.get('time', '')}|{r.get('merchant')}|{r.get('amount')}"
    r['originalSignature'] = sig
    fuzzy = f"{r.get('date')}|{r.get('merchant')}|{r.get('amount')}"
    if sig not in seen_sigs and fuzzy not in seen_sigs:
        seen_sigs.add(sig)
        seen_sigs.add(fuzzy)
        combined.append(r)

# Add excel records
added_excel = 0
for r in excel_recs:
    sig = r['originalSignature']
    fuzzy = r.get('_fuzzy_sig') or f"{r.get('date')}|{r.get('merchant')}|{r.get('amount')}"
    if sig in seen_sigs or fuzzy in seen_sigs:
        continue
    r.pop('_fuzzy_sig', None)
    combined.append(r)
    seen_sigs.add(sig)
    seen_sigs.add(fuzzy)
    added_excel += 1

# Sort chronologically
combined.sort(key=lambda x: (x.get('date', ''), x.get('time', '')))
for idx, r in enumerate(combined, 1):
    r['id'] = idx
    r['origId'] = idx

print(f"Total merged records: {len(combined)}")
print(f"From backup: {len(backup_recs)}, Newly added from Oct 22 excel: {added_excel}")
dates = [r.get('date') for r in combined if r.get('date')]
print(f"Date range: {min(dates)} ~ {max(dates)}")

oct22 = [r for r in combined if r.get('date') == '2026-10-22']
print(f"Oct 22 records count: {len(oct22)}")
for r in oct22:
    print(r.get('time'), r.get('merchant'), r.get('amount'), r.get('actualCard'))

# Save to Supabase
SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

resp = requests.post(f"{SUPABASE_URL}/rest/v1/app_settings", headers=headers, json=[{"key": "records", "value": combined}])
print("Save to Supabase status:", resp.status_code)
