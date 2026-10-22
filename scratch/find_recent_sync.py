import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://jkuuwmuniuvijvbtvwde.supabase.co/rest/v1/app_settings?key=eq.records&select=*'
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE'
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    records = data[0]['value'] if data else []
    print(f'Total records: {len(records)}')
    
    recent = [r for r in records if r.get('date', '') >= '2026-10-18']
    print(f'Records on or after 2026-10-18: {len(recent)}')
    for r in recent:
        print(f"{r.get('date')} {r.get('time')} | {r.get('merchant')} | {r.get('amount'):,}원 | {r.get('paymentMethod')} | cat:{r.get('category')} | sub:{r.get('subCategory')} | type:{r.get('type')}")
