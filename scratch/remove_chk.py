import os

html_path = "d:/AI App/daily/index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

import re
html = re.sub(r'<label[^>]*><input[^>]*id="chkNewMainFixed"[^>]*> 고정비</label>', '', html)
html = re.sub(r'<label[^>]*><input[^>]*id="chkNewSubFixed"[^>]*> 고정비</label>', '', html)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
