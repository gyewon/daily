import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

print(f"Total records in Supabase: {len(records)}")

candidates = []
for r in records:
    is_inst = r.get('isInstallment')
    inst_field = r.get('installment')
    memo = str(r.get('memo') or '')
    merchant = str(r.get('merchant') or '')
    if is_inst == 'Y' or (inst_field and inst_field != '일시불') or '할부' in memo or '/' in memo or '할부' in merchant:
        candidates.append(r)

print(f"Installment related records count: {len(candidates)}\n")
for r in candidates:
    rid = r.get('id')
    dt = r.get('date')
    tm = r.get('time')
    is_inst = r.get('isInstallment')
    inst = r.get('installment')
    memo = r.get('memo')
    mc = r.get('merchant')
    amt = r.get('amount')
    card = r.get('actualCard')
    print(f"[{rid:3d}] {dt} {tm} | isInst: {is_inst} | inst: {inst} | memo: '{memo}' | {mc} | {amt:,d}원 | {card}")
