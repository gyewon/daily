import json, sys

sys.stdout.reconfigure(encoding='utf-8')

path = r'C:/Users/js011/.gemini/antigravity-ide/brain/bf755f71-309a-4ee8-ac89-504218c239e6/.system_generated/logs/transcript_full.jsonl'

with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        if 5300 <= idx <= 5382:
            tcs = obj.get('tool_calls', [])
            for tc in tcs:
                name = tc.get('name')
                args = tc.get('args', {})
                if name in ('write_to_file', 'run_command'):
                    print(f"Step {idx} [{name}]: {str(args)[:150]}")
