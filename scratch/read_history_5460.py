import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/js011/.gemini/antigravity-ide/brain/bf755f71-309a-4ee8-ac89-504218c239e6/.system_generated/logs/transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index', 0)
        if 5460 <= idx <= 5500:
            print(f"=== Step {idx} ({obj.get('source')} / {obj.get('type')}) ===")
            content = obj.get('content') or ''
            print(content[:300])
            if obj.get('tool_calls'):
                for tc in obj.get('tool_calls'):
                    print(' Tool Call:', tc.get('name'), str(tc.get('args'))[:200])
