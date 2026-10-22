import requests

url = 'https://jkuuwmuniuvijvbtvwde.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE'
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

res = requests.get(f'{url}/rest/v1/app_settings?key=eq.records', headers=headers)
data = res.json()
if data:
    records = data[0]['value']
    print(f"Total records in app_settings.records: {len(records)}")
    insts = [r for r in records if r.get('isInstallment') == 'Y']
    print(f"Installments: {len(insts)}")
    for r in insts[:10]:
        print(r.get('id'), r.get('date'), r.get('merchant'), r.get('amount'), r.get('isInstallment'), r.get('installment'), r.get('memo'))
else:
    print("No app_settings.records found, checking /records table...")
    res2 = requests.get(f'{url}/rest/v1/records?select=count', headers=headers)
    print(res2.text)
