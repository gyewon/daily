import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

inst_ids = [13, 23, 28, 87, 115, 116, 117, 125, 133, 136, 144, 215]

for r in records:
    if r.get('id') in inst_ids:
        print(f"ID {r.get('id'):3d} | {r.get('date')} | exclude={r.get('exclude')} | isFixed={r.get('isFixed')} | amt={r.get('amount')} | bAmt={r.get('billingAmount')} | card={r.get('actualCard')} | memo='{r.get('memo')}' | mc={r.get('merchant')}")
