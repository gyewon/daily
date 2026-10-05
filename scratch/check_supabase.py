import json, re, requests
html = open('app.js', encoding='utf-8').read()
url = re.search(r'supabaseUrl\s*=\s*[\'"`](.*?)[\'"`]', html).group(1)
key = re.search(r'supabaseKey\s*=\s*[\'"`](.*?)[\'"`]', html).group(1)
res = requests.get(f'{url}/rest/v1/records', headers={'apikey': key, 'Authorization': f'Bearer {key}'})
data = res.json()
match = [r for r in data if 'Airbnb' in str(r.get('merchant', '')) or '813074' in str(r.get('amount', ''))]
print('Matches:', len(match))
if match: print(match[0])
