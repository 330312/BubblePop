import json
import os
import sys
import traceback

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Local import (python/Agent.py)
from Agent import ReActTrinityAnalyzer


def _load_input() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    # Replace invalid surrogate characters
    raw = raw.encode('utf-8', errors='replace').decode('utf-8')
    return json.loads(raw)


def main():
    try:
        payload = _load_input()
        raw_text = payload.get("rawText") or payload.get("text") or ""

        # Member D's Agent.py expects an api_key string.
        # We support a few env var names for convenience.
        api_key = (
            os.environ.get("ZAI_API_KEY")
            or os.environ.get("ZHIPU_API_KEY")
            or os.environ.get("GLM_API_KEY")
        )
        if not api_key:
            out = {"code": 500, "msg": "Missing API key env (ZAI_API_KEY)", "data": None}
            sys.stdout.write(json.dumps(out, ensure_ascii=False))
            return

        analyzer = ReActTrinityAnalyzer(api_key=api_key)
        result_json_str = analyzer.run(raw_text)

        # analyzer.run returns a JSON string already.
        sys.stdout.write(result_json_str)

    except Exception as e:
        out = {
            "code": 500,
            "msg": "agent_runner error",
            "data": {
                "error": str(e),
                "trace": traceback.format_exc()[-4000:],
            },
        }
        sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
