import re

file_path = "d:/AI App/daily/app.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add storage key
content = content.replace("const MASTER_CAT_STORAGE_KEY = 'gyewon_master_categories_v1';", "const MASTER_CAT_STORAGE_KEY = 'gyewon_master_categories_v1';\n  const FIXED_CAT_STORAGE_KEY = 'gyewon_fixed_cats_v1';")

# 2. Add appState property
content = content.replace("filterInstallment: 'ALL',", "filterInstallment: 'ALL',\n    fixedCategories: new Set(),")

# 3. Load fixedCategories
content = content.replace("const localCats = localStorage.getItem(MASTER_CAT_STORAGE_KEY);", "const localCats = localStorage.getItem(MASTER_CAT_STORAGE_KEY);\n      const localFixedCats = localStorage.getItem(FIXED_CAT_STORAGE_KEY);")
content = content.replace("if (localRules) appState.categoryRules = JSON.parse(localRules);", "if (localRules) appState.categoryRules = JSON.parse(localRules);\n      if (localFixedCats) appState.fixedCategories = new Set(JSON.parse(localFixedCats));")

# 4. Save fixedCategories
content = content.replace("function saveMasterCategories() {", "function saveFixedCategories() {\n    localStorage.setItem(FIXED_CAT_STORAGE_KEY, JSON.stringify(Array.from(appState.fixedCategories)));\n  }\n\n  function saveMasterCategories() {")

# 5. Update KPI Calculation
kpi_replacement = """
    let totalAmt = 0;
    let fixedAmt = 0;
    
    filtered.forEach(r => {
      const amt = Number(r.amount) || 0;
      totalAmt += amt;
      if (r.isFixed === 'Y') {
        fixedAmt += amt;
      }
    });
    
    let livingAmt = totalAmt - fixedAmt;
    
    document.getElementById('kpiLivingAmount').textContent = formatCurrency(livingAmt);
    document.getElementById('kpiFixedAmountText').textContent = `고정비: ${formatCurrency(fixedAmt)}원 (총 지출 ${formatCurrency(totalAmt)}원)`;
    document.getElementById('kpiDailyAvg').textContent = `일평균 ${formatCurrency(Math.floor(livingAmt / 30))}원 (생활비 기준)`;
"""
# We'll replace the existing KPI 1 logic with regex
content = re.sub(r"let totalAmt = 0;[\s\S]*?document\.getElementById\('kpiDailyAvg'\)\.textContent = `일평균 \$\{formatCurrency\(dailyAvg\)\}원`;", kpi_replacement.strip(), content)

# 6. Table rendering (Add fixed column)
content = content.replace("          <td class=\"col-exclude\">", """          <td class="col-exclude">""") # anchor
content = re.sub(r'(<td class="col-exclude">[\s\S]*?</td>)', r'\1\n          <td class="col-fixed" style="text-align:center;">\n            <button class="fixed-toggle-btn ${rec.isFixed === \'Y\' ? \'active-y\' : \'\'}" data-id="${rec.id}" title="고정비/생활비 토글" style="width: 50px; font-size:0.8rem; border-radius:12px; padding:4px; border:1px solid ${rec.isFixed === \'Y\' ? \'var(--primary-color)\' : \'var(--border-color)\'}; background:${rec.isFixed === \'Y\' ? \'var(--primary-color)\' : \'transparent\'}; color:${rec.isFixed === \'Y\' ? \'white\' : \'var(--text-muted)\'};">\n              ${rec.isFixed === \'Y\' ? \'고정\' : \'변동\'}\n            </button>\n          </td>', content)

# 7. Table Event Listener for fixed toggle
toggle_listener = """
    // Toggle Fixed/Variable
    if (target.closest('.fixed-toggle-btn')) {
      const btn = target.closest('.fixed-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.isFixed = rec.isFixed === 'Y' ? 'N' : 'Y';
        saveData();
        renderAll();
        showToast(`${rec.merchant} 내역이 ${rec.isFixed === 'Y' ? '고정비' : '생활비(변동비)'}로 설정되었습니다.`, 'success');
      }
      return;
    }
"""
content = content.replace("if (target.closest('.exclude-toggle-btn')) {", toggle_listener + "\n    if (target.closest('.exclude-toggle-btn')) {")

# 8. Category Manage logic for New Categories
content = content.replace("const mainCatName = document.getElementById('newMainCategoryName').value.trim();", "const mainCatName = document.getElementById('newMainCategoryName').value.trim();\n      const isFixed = document.getElementById('chkNewMainFixed').checked;")
content = content.replace("appState.masterCategories[mainCatName] = [];", "appState.masterCategories[mainCatName] = [];\n      if (isFixed) { appState.fixedCategories.add(mainCatName); saveFixedCategories(); }")
content = content.replace("document.getElementById('newMainCategoryName').value = '';", "document.getElementById('newMainCategoryName').value = '';\n      document.getElementById('chkNewMainFixed').checked = false;")

content = content.replace("const subCatName = document.getElementById('newSubCategoryName').value.trim();", "const subCatName = document.getElementById('newSubCategoryName').value.trim();\n      const isFixed = document.getElementById('chkNewSubFixed').checked;")
content = content.replace("appState.masterCategories[mainCat].push(subCatName);", "appState.masterCategories[mainCat].push(subCatName);\n      if (isFixed) { appState.fixedCategories.add(`${mainCat}|${subCatName}`); saveFixedCategories(); }")
content = content.replace("document.getElementById('newSubCategoryName').value = '';", "document.getElementById('newSubCategoryName').value = '';\n      document.getElementById('chkNewSubFixed').checked = false;")

# 9. Render Category UI to show fixed status and toggle it
main_cat_replace = """
          <span style="font-weight: 600; font-size: 0.95rem;">
            ${cat} <span class="fixed-badge" style="cursor:pointer; font-size:0.75rem; background:${appState.fixedCategories.has(cat) ? 'var(--primary-color)' : 'var(--bg-input)'}; color:${appState.fixedCategories.has(cat) ? 'white' : 'var(--text-muted)'}; padding:2px 6px; border-radius:4px; margin-left:4px;" data-cat="${cat}" title="고정비 지정 토글">${appState.fixedCategories.has(cat) ? '고정비' : '변동비'}</span>
          </span>
"""
content = re.sub(r'<span style="font-weight: 600; font-size: 0.95rem;">\$\{cat\}</span>', main_cat_replace.strip(), content)

sub_cat_replace = """
          <span style="font-size: 0.9rem;">
            ${sub} <span class="fixed-badge" style="cursor:pointer; font-size:0.75rem; background:${appState.fixedCategories.has(mainCat+'|'+sub) ? 'var(--primary-color)' : 'var(--bg-input)'}; color:${appState.fixedCategories.has(mainCat+'|'+sub) ? 'white' : 'var(--text-muted)'}; padding:2px 6px; border-radius:4px; margin-left:4px;" data-subcat="${mainCat}|${sub}" title="고정비 지정 토글">${appState.fixedCategories.has(mainCat+'|'+sub) ? '고정비' : '변동비'}</span>
          </span>
"""
content = re.sub(r'<span style="font-size: 0.9rem;">\$\{sub\}</span>', sub_cat_replace.strip(), content)

# 10. Auto-check fixed categories logic for rules and excel uploads
# We add a helper function `checkFixedCategory(rec)`
helper_func = """
  function checkFixedCategory(rec) {
    if (appState.fixedCategories.has(rec.category)) {
      rec.isFixed = 'Y';
    } else if (appState.fixedCategories.has(`${rec.category}|${rec.subCategory}`)) {
      rec.isFixed = 'Y';
    } else {
      rec.isFixed = 'N'; // Or leave as is if manually toggled? But if category changes, it should update.
    }
  }
"""
content = content.replace("function saveCards() {", helper_func + "\n  function saveCards() {")

# In applyCategoryRules:
content = content.replace("result.changed = true;", "checkFixedCategory(rec);\n            result.changed = true;")

# In applyExcelData:
content = content.replace("appState.records.push(newRec);", "checkFixedCategory(newRec);\n          appState.records.push(newRec);")
content = content.replace("appState.records = [...pendingUploadedRecords];", "pendingUploadedRecords.forEach(r => checkFixedCategory(r));\n      appState.records = [...pendingUploadedRecords];")

# Add click event delegation for .fixed-badge
badge_event = """
    document.getElementById('categoryManageModal')?.addEventListener('click', e => {
      const badge = e.target.closest('.fixed-badge');
      if (badge) {
        const cat = badge.dataset.cat;
        const subcat = badge.dataset.subcat;
        const key = cat || subcat;
        if (appState.fixedCategories.has(key)) {
          appState.fixedCategories.delete(key);
        } else {
          appState.fixedCategories.add(key);
        }
        saveFixedCategories();
        if (cat) renderManageMainCategories();
        if (subcat) renderManageSubCategories();
      }
    });
"""
content = content.replace("document.getElementById('newMainCategoryForm')?.addEventListener('submit', (e) => {", badge_event + "\n    document.getElementById('newMainCategoryForm')?.addEventListener('submit', (e) => {")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fix script completed.")
