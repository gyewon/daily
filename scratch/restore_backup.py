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

with open("backups/backup_2026-10-05.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)

app_settings = backup_data.get("app_settings", [])

print(f"Restoring {len(app_settings)} app_settings keys to Supabase...")
for item in app_settings:
    key = item.get("key")
    val = item.get("value")
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/app_settings",
        headers=SUPABASE_HEADERS,
        json=[{"key": key, "value": val}]
    )
    print(f"Restored key: {key} (Status: {resp.status_code})")

print("Backup restoration complete!")
