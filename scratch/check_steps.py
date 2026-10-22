import json, sys

sys.stdout.reconfigure(encoding='utf-8')

path = r'C:/Users/js011/.gemini/antigravity-ide/brain/bf755f71-309a-4ee8-ac89-504218c239e6/.system_generated/logs/transcript_full.jsonl'

with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        if 5375 <= idx <= 5395:
            print(f"=== Step {idx} ({obj.get('source')} / {obj.get('type')}) ===")
            content = obj.get('content') or ''
            print(content[:300].replace('\n', ' '))
            for tc in obj.get('tool_calls', []):
                print('  Tool Call:', tc.get('name'), str(tc.get('args'))[:200])
