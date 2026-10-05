import json
import requests

SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

resp = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.records", headers=SUPABASE_HEADERS)
recs = resp.json()[0]['value']

for r in recs:
    d = r.get('date', '')
    if '-' in d:
        m_num = int(d.split('-')[1])
        r['month'] = f"{m_num}월"

print(f"Cleaned {len(recs)} records.")
print("Unique months:", set(r['month'] for r in recs))

res = requests.post(
    f"{SUPABASE_URL}/rest/v1/app_settings",
    headers=SUPABASE_HEADERS,
    json=[{"key": "records", "value": recs}]
)
print("Saved to Supabase:", res.status_code)
