import re

html = open('index.html', 'r', encoding='utf-8').read()
modal_matches = re.findall(r'id="([^"]*[Mm]odal[^"]*)"', html)
print('Modals found:', modal_matches)

for m in modal_matches:
    print(f"\n--- Modal ID: {m} ---")
    start = html.find(f'id="{m}"')
    print(html[start:start+300])
