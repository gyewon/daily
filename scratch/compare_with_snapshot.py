import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('d:/AI App/daily/scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    old_records = json.load(f)

def get_sig(r):
    return f"{r.get('date')}|{r.get('time') or ''}|{r.get('merchant')}|{r.get('amount')}"

old_sigs = set(get_sig(r) for r in old_records)

with open('d:/AI App/daily/scratch/uploaded_expenses.json', 'r', encoding='utf-8') as f:
    uploaded = json.load(f)

print(f"Old records in snapshot (19:30): {len(old_records)}")
print(f"Uploaded records from Excel: {len(uploaded)}")

new_in_upload = []
for u in uploaded:
    # in uploaded_expenses.json, amount was stored directly from excel:
    # if amount is negative in excel, in app.js amount = -amt = positive
    amt = -u['amount']
    sig = f"{u['date']}|{u['time']}|{u['merchant']}|{amt}"
    if sig not in old_sigs:
        new_in_upload.append((sig, u, amt))

print(f"\nUploaded items not in 19:30 snapshot: {len(new_in_upload)}")
for sig, u, amt in new_in_upload:
    print(f"Row {u['row']} | {sig} | {u['origPay']} | {u['category']}")
