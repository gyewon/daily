import os
import re

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

# Fix checkFixedCategory
js = re.sub(r"function checkFixedCategory\(rec\) \{ rec\.isFixed = \(rec\.category === '고정비'\) \? 'Y' : 'N'; \}\s*else if \([\s\S]*?\}", r"function checkFixedCategory(rec) {\n    rec.isFixed = (rec.category === '고정비') ? 'Y' : 'N';\n  }", js)

# Remove badge from Main Category list rendering (line ~2153)
# It looks like: ${cat} <span class="fixed-badge" ... >...</span>
js = re.sub(r'<span class="fixed-badge"[^>]*>.*?</span>', '', js)

# Remove click events for fixed-badge
js = re.sub(r"if \(target\.matches\('\.fixed-badge'\)\) \{[\s\S]*?saveData\(\);\s*\}", "", js)

# Remove isFixed logic from appState
js = re.sub(r"fixedCategories:\s*new Set\(\),", "", js)

with open(js_path, "w", encoding="utf-8") as f:
    f.write(js)
