import os

js_path = "d:/AI App/daily/app.js"
with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

lines = js.split('\n')
for i, line in enumerate(lines):
    if 'btn-delete-main-cat' in line and 'target.matches' in line:
        print(f"Main cat deletion found at line {i+1}")
    if 'btn-delete-sub-cat' in line and 'target.matches' in line:
        print(f"Sub cat deletion found at line {i+1}")

