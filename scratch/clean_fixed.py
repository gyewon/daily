import os
import re

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

# Remove the badge click event listener
js = re.sub(r'document\.getElementById\(\'categoryManageModal\'\)\?\.addEventListener\(\'click\', e => \{[\s\S]*?if \(subcat\) renderManageSubCategories\(\);\n\s*\}\n\s*\}\);\n', '', js)

# Remove fixed category add logic in newMainCategoryForm
js = re.sub(r'if \(isFixed\) \{[\s\S]*?saveFixedCategories\(\);\n\s*\}', '', js)

# Remove fixed category add logic in newSubCategoryForm
js = re.sub(r'if \(isFixed\) \{[\s\S]*?saveFixedCategories\(\);\n\s*\}', '', js)

# Remove loadData logic for fixedCategories
js = re.sub(r"if \(s\.key === 'fixed_categories'\) appState\.fixedCategories = new Set\(s\.value\);", "", js)

with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)
