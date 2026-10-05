import requests
import json

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

cleaned = []
seen_sigs = set()

for r in recs:
    merchant = r.get('merchant', '')
    # Remove records that contain corrupted characters
    if '\ufffd' in merchant:
        print(f"Removed corrupted record ID {r.get('id')}")
        continue
    
    # Remove duplicates based on originalSignature
    sig = r.get('originalSignature')
    if sig:
        if sig in seen_sigs:
            print(f"Removed duplicate record ID {r.get('id')}: {merchant}")
            continue
        seen_sigs.add(sig)
        
    cleaned.append(r)

print(f"Original count: {len(recs)}, Cleaned count: {len(cleaned)}")

res = requests.post(
    f"{SUPABASE_URL}/rest/v1/app_settings",
    headers=SUPABASE_HEADERS,
    json=[{"key": "records", "value": cleaned}]
)
print("Saved to Supabase:", res.status_code)
