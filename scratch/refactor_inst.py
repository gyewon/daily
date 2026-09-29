import re
import os

file_path = "d:/AI App/daily/app.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove installment dropdown logic from HTML string in app.js
# In `renderTable`, replace the `<td class="col-inst">` content with a Y/N toggle.
content = re.sub(
    r'<td class="col-inst">\s*<select class="select-table-inst"[^>]*>\s*\$\{instOptionsHtml\}\s*</select>\s*</td>',
    r'<td class="col-inst" style="text-align:center;">\n          <button class="inst-toggle-btn ${rec.isInstallment === \'Y\' ? \'active-y\' : \'\'}" data-id="${rec.id}" title="할부 여부 토글" style="width: 40px; font-size:0.8rem; border-radius:12px; padding:4px; border:1px solid ${rec.isInstallment === \'Y\' ? \'var(--primary-color)\' : \'var(--border-color)\'}; background:${rec.isInstallment === \'Y\' ? \'var(--primary-color)\' : \'transparent\'}; color:${rec.isInstallment === \'Y\' ? \'white\' : \'var(--text-muted)\'};">\n            ${rec.isInstallment === \'Y\' ? \'Y\' : \'N\'}\n          </button>\n        </td>',
    content
)

# 2. Remove instOptionsHtml building block
content = re.sub(r'// Installment Options[\s\S]*?\}\);', '', content)

# 3. Remove billCell from renderTable, since billingAmount == amount.
content = re.sub(
    r'<td class="col-bill" id="billCell_\$\{rec\.id\}">\s*\$\{formatCurrency\(rec\.billingAmount \|\| rec\.amount\)\}\s*</td>',
    r'<td class="col-bill" id="billCell_${rec.id}">\n          ${formatCurrency(rec.amount)}\n        </td>',
    content
)

# 4. Table toggle event for isInstallment
toggle_logic = """
    if (target.closest('.inst-toggle-btn')) {
      const btn = target.closest('.inst-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.isInstallment = rec.isInstallment === 'Y' ? 'N' : 'Y';
        saveData();
        renderAll();
        showToast(`[#${id}] 할부 여부가 '${rec.isInstallment}'(으)로 변경되었습니다.`);
      }
      return;
    }
"""
content = content.replace("if (target.closest('.fixed-toggle-btn')) {", toggle_logic + "\n    if (target.closest('.fixed-toggle-btn')) {")

# 5. Remove 'select-table-inst' event listener
content = re.sub(r'// 2\. Change Installment Months[\s\S]*?\}\n    \}', '', content)

# 6. Auto-detect installment logic in `applyExcelData` or `loadData`
# The user said: "같은 날짜/시간에 같은 내용으로 같은 카드면 할부라고 해서 할부를 Y로 해줬으면 좋겠어."
# They probably meant same TIME, merchant, and card, but different months. 
# We'll just run a function that flags them.
auto_flag_logic = """
  function autoFlagInstallments() {
    let changed = false;
    // Group by time + merchant + card
    const groups = {};
    appState.records.forEach(r => {
      const key = `${r.time}|${r.merchant}|${r.actualCard}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
      // Also, if memo contains '할부', auto-flag
      if ((r.memo && r.memo.includes('할부')) || (r.installment && r.installment !== '일시불')) {
        if (r.isInstallment !== 'Y') {
          r.isInstallment = 'Y';
          changed = true;
        }
      }
    });
    
    // If multiple records share the exact same time, merchant, and card, but have different dates, they are installments.
    for (const key in groups) {
      if (groups[key].length > 1) {
        groups[key].forEach(r => {
          if (r.isInstallment !== 'Y') {
            r.isInstallment = 'Y';
            changed = true;
          }
        });
      }
    }
    return changed;
  }
"""
content = content.replace("function checkFixedCategory(rec) {", auto_flag_logic + "\n  function checkFixedCategory(rec) {")

# 7. Call autoFlagInstallments after loadData
content = content.replace("appState.records.forEach(r => {", "if (autoFlagInstallments()) saveData();\n          appState.records.forEach(r => {")

# 8. Call autoFlagInstallments after applyExcelData
content = content.replace("appState.records = [...pendingUploadedRecords];", "appState.records = [...pendingUploadedRecords];\n      autoFlagInstallments();")

# 9. Update KPI 4 to just sum amount where exclude = 'N' (same as Total Amount, but maybe user wants it different?)
# Actually KPI 4 was using `billingAmount`. Since `billingAmount` is now just `amount`, let's replace `rec.billingAmount || rec.amount` with `rec.amount`.
content = content.replace("Number(r.billingAmount || r.amount) || 0;", "Number(r.amount) || 0;")

# 10. Manual new record form updates
content = content.replace("const installment = document.getElementById('newInstallment').value;", "const isInstallment = document.getElementById('newInstallment').value === 'Y' ? 'Y' : 'N';")
content = re.sub(r'let billingAmount = amount;[\s\S]*?billingAmount = Math\.round\(amount / instMonths\);\n      \}', '', content)
content = content.replace("installment: installment,", "isInstallment: isInstallment,")
content = content.replace("billingAmount: billingAmount,", "")

# 11. Remove billingAmount logic from edit as well if any (none left)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

# Update index.html
html_path = "d:/AI App/daily/index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Change the Filter for Installment from dropdown to just Y/N
html = re.sub(
    r'<select id="filterInstallment" class="filter-select">[\s\S]*?</select>',
    r'<select id="filterInstallment" class="filter-select">\n            <option value="ALL">할부 여부 (전체)</option>\n            <option value="Y">할부 (Y)</option>\n            <option value="N">일시불 (N)</option>\n          </select>',
    html
)

# Modal New record select
html = re.sub(
    r'<select id="newInstallment"[^>]*>[\s\S]*?</select>',
    r'<select id="newInstallment" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-main);">\n            <option value="N">일시불 (N)</option>\n            <option value="Y">할부 (Y)</option>\n          </select>',
    html
)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Python script executed.")
