import re

file_path = "d:/AI App/daily/app.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove the returns from charts and KPIs so they are no longer excluded
content = re.sub(r"\s*if \(r\.exclude === 'Y'\) return;", "", content)
content = re.sub(r"\s*if \(r\.exclude === 'Y' \|\| !r\.date\) return;", "\n      if (!r.date) return;", content)
content = re.sub(r"filtered\.filter\(r => r\.exclude !== 'Y'\)\.reduce", "filtered.reduce", content)
content = re.sub(r"appState\.records\.filter\(r => r\.exclude !== 'Y' &&", "appState.records.filter(r => ", content)

# Change the toggle button UI
content = content.replace(
    '''<button class="exclude-toggle-btn ${isExcluded ? 'active-y' : ''}" data-id="${rec.id}" title="클릭하여 집계 제외/포함 토글">
            ${rec.exclude}
          </button>''',
    '''<button class="exclude-toggle-btn ${isExcluded ? 'active-y' : ''}" data-id="${rec.id}" title="결제 상태 토글" style="width: 50px; font-size:0.8rem; border-radius:12px; padding:4px;">
            ${isExcluded ? '완료' : '대기'}
          </button>'''
)

# Update KPI label
content = content.replace(
    "document.getElementById('kpiExcludedCount').textContent = `${excludedCount}건 제외 중`;",
    "document.getElementById('kpiExcludedCount').textContent = `${excludedCount}건 완료`;"
)

# Change toast message
content = content.replace("`${rec.merchant} 내역이 통계에서 제외되었습니다.`", "`${rec.merchant} 내역이 결제 완료 처리되었습니다.`")
content = content.replace("`${rec.merchant} 내역이 다시 통계에 포함됩니다.`", "`${rec.merchant} 결제가 대기 상태로 변경되었습니다.`")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
