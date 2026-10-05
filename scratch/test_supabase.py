import requests
import json

SUPABASE_URL = "https://jkuuwmuniuvijvbtvwde.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# 1. Test fetching app_settings
resp = requests.get(f"{SUPABASE_URL}/rest/v1/app_settings?select=*", headers=headers)
print("app_settings status:", resp.status_code)
settings = resp.json()
print("app_settings keys:", [s.get('key') for s in settings])

for s in settings:
    if s.get('key') == 'records':
        recs = s.get('value') or []
        print(f"Total records in app_settings: {len(recs)}")
        if recs:
            print("Sample record:", recs[0])
