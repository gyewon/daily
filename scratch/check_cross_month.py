import json, sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

by_amt = defaultdict(list)
for r in records:
    amt = r.get('amount')
    if amt and amt >= 30000:
        by_amt[amt].append(r)

for amt, recs in sorted(by_amt.items()):
    if len(recs) > 1:
        months = set(r.get('month') for r in recs)
        if len(months) > 1:
            print(f"=== Amount {amt:,d}원 (Months: {months}) ===")
            for r in recs:
                print(f"  ID {r.get('id'):3d} | {r.get('date')} {r.get('time')} | {r.get('merchant')} | {r.get('actualCard')} | isInst: {r.get('isInstallment')} | memo: '{r.get('memo')}'")
