import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/current_supabase_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

installmentRecords = [r for r in records if r.get('isInstallment') == 'Y' and not r.get('isCanceled') and (float(r.get('amount') or 0)) > 0]

trackingMap = {}

for r in installmentRecords:
    memo = r.get('memo') or ''
    import re
    m = re.search(r'(.*?)(\d+)\s*/\s*(\d+)(.*)', memo)
    if m:
        currentIdx = int(m.group(2))
        totalIdx = int(m.group(3))
        key = f"{r.get('merchant')}_{r.get('actualCard')}_{totalIdx}_{r.get('amount')}"
        if key not in trackingMap or currentIdx > trackingMap[key]['currentIdx'] or (currentIdx == trackingMap[key]['currentIdx'] and r.get('date') > trackingMap[key]['lastDate']):
            trackingMap[key] = {
                'merchant': r.get('merchant'),
                'card': r.get('actualCard'),
                'amount': float(r.get('amount') or 0),
                'currentIdx': currentIdx,
                'totalIdx': totalIdx,
                'lastDate': r.get('date'),
                'memo': memo
            }

print("=== Current UI Installment Tracker Output ===")
totalLeft = 0
activeCount = 0
for k, item in trackingMap.items():
    if item['currentIdx'] < item['totalIdx']:
        monthsLeft = item['totalIdx'] - item['currentIdx']
        leftAmt = monthsLeft * item['amount']
        totalLeft += leftAmt
        activeCount += 1
        print(f"가맹점: {item['merchant']} [{item['card']}]")
        print(f"  메모: {item['memo']}")
        print(f"  진행: {item['currentIdx']}/{item['totalIdx']}회 ({monthsLeft}개월 남음, 월 {item['amount']:,.0f}원, 최근청구: {item['lastDate']})")
        print(f"  남은 금액: {leftAmt:,.0f}원\n")

print(f"총 진행 중인 할부: {activeCount}건, 총 남은 금액: {totalLeft:,.0f}원")
