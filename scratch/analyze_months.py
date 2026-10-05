import json
import requests

SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"

resp = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.records", headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
})

recs = resp.json()[0]['value']
print(f"Total records in DB: {len(recs)}")

dates_by_month = {}
corrupted_count = 0

for r in recs:
    d = r.get('date', '')
    m_calc = f"{int(d.split('-')[1])}월" if '-' in d else '기타'
    m_stored = r.get('month', '')
    if m_stored != m_calc:
        corrupted_count += 1
    dates_by_month[m_calc] = dates_by_month.get(m_calc, 0) + 1

print(f"Dates distribution by actual date: {dates_by_month}")
print(f"Records with corrupted/mismatched 'month' field: {corrupted_count}")

# Print sample 10월 records
oct_recs = [r for r in recs if r.get('date', '').startswith('2026-10')]
print(f"October (10월) records count: {len(oct_recs)}")
for r in oct_recs[:5]:
    print(r.get('date'), r.get('merchant'), r.get('amount'), r.get('actualCard'))
