import sys

sys.stdout.reconfigure(encoding='utf-8')

fp = r'C:\Users\js011\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\005887.ldb'

with open(fp, 'rb') as f:
    data = f.read()

pos = 0
matches = []
while True:
    pos = data.find(b'gyewon_appState_cache', pos)
    if pos == -1:
        break
    matches.append(pos)
    pos += 21

print(f"Found {len(matches)} occurrences in 005887.ldb at positions: {matches}")

for p in matches:
    print(f"\n--- Around position {p} ---")
    chunk = data[max(0, p-50):min(len(data), p+500)]
    print(repr(chunk[:300]))
