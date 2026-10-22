import sys
import os
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
print(f"Total records in Supabase: {len(recs)}")

sorted_recs = sorted(recs, key=lambda x: (x.get('date', ''), x.get('time', '')), reverse=True)
print("--- Top 25 records ---")
for r in sorted_recs[:25]:
    print(f"ID {r.get('id')}: {r.get('date')} {r.get('time')} | {r.get('merchant')} | {r.get('amount')}원 | {r.get('actualCard')}")

logs = settings.get('notification_logs', [])
print(f"\n--- Notification logs (recent 5) ---")
for l in logs[:5]:
    print(l)

