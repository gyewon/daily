import os, sys, re, json

sys.stdout.reconfigure(encoding='utf-8')

dir_path = r'C:\Users\js011\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb'

all_files = [os.path.join(dir_path, f) for f in os.listdir(dir_path) if f.endswith('.ldb') or f.endswith('.log')]

print(f"Scanning {len(all_files)} files in Chrome LevelDB...")

found_caches = []

for fp in all_files:
    try:
        with open(fp, 'rb') as f:
            data = f.read()
            
        # Search for gyewon_appState_cache
        idx = 0
        while True:
            pos = data.find(b'gyewon_appState_cache', idx)
            if pos == -1:
                break
            # Look around pos for JSON
            snippet = data[pos:pos+500000]
            # Try to find { ... }
            brace_start = snippet.find(b'{"records":')
            if brace_start == -1:
                brace_start = snippet.find(b'{"')
            if brace_start != -1:
                # find matching end brace or try parsing
                for end_offset in range(len(snippet), brace_start + 100, -1000):
                    chunk = snippet[brace_start:end_offset]
                    try:
                        parsed = json.loads(chunk.decode('utf-8', errors='ignore'))
                        if 'records' in parsed and len(parsed['records']) > 50:
                            found_caches.append((fp, len(parsed['records']), parsed))
                            print(f"FOUND valid cache in {os.path.basename(fp)}: {len(parsed['records'])} records!")
                            break
                    except Exception:
                        pass
            idx = pos + 20
    except Exception as e:
        print(f"Error reading {fp}: {e}")

print(f"\nTotal valid caches found: {len(found_caches)}")
for fp, cnt, parsed in found_caches:
    print(f"  File: {os.path.basename(fp)} | Count: {cnt} records")
    # Save the largest one to scratch/recovered_chrome_cache.json
    with open('scratch/recovered_chrome_cache.json', 'w', encoding='utf-8') as out:
        json.dump(parsed, out, ensure_ascii=False, indent=2)
    print("Saved to scratch/recovered_chrome_cache.json!")
