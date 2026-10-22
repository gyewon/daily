import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

sep_recs = [r for r in records if r.get('date', '').startswith('2026-09')]
oct_recs = [r for r in records if r.get('date', '').startswith('2026-10')]

print(f"September records: {len(sep_recs)}, October records: {len(oct_recs)}\n")

# Find recurring amounts or matching merchants
print("=== Checking known installment merchants and amounts ===")
merchants = ['유앤아이의원', '인터넷상거래', '마키노차야', '하나카드', '신세계면세점', '세금', '지방세']

for m in merchants:
    print(f"\n--- Merchant keyword: {m} ---")
    matched = [r for r in records if m in (r.get('merchant') or '') or m in (r.get('memo') or '')]
    for r in matched:
        print(f"  [{r.get('id'):3d}] {r.get('date')} {r.get('time')} | {r.get('merchant')} | {r.get('amount'):,d}원 | card: {r.get('actualCard')} | isInst: {r.get('isInstallment')} | memo: '{r.get('memo')}'")
