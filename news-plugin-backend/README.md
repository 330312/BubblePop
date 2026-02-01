# News Plugin Backend (Express)

This is a minimal Express backend for the pipeline:

> 划词 query -> 博查搜索 ->（可选）调用成员 D 的 Agent.py -> 返回结构化 JSON

It implements two APIs:
- `POST /api/analyze` (PRD main API)
- `POST /api/search` (debug / agent helper)

## 1) Quick start

```bash
cd news-plugin-backend
cp .env.example .env
# fill BOCHA_API_KEY

npm i
npm run dev
```

Server defaults to `http://localhost:8787`.

## 2) Environment variables

Key settings (see `.env.example` for full list):

- `BOCHA_API_KEY` (required): your Bocha Search API key (get from https://open.bochaai.com/)
- `CORS_ORIGINS`: `*` for dev or comma-separated origins

### Agent integration (optional)

Choose one:

#### Option A: **process mode** (recommended if you have Agent.py as a local file)

- Set:
  - `AGENT_MODE=process`
  - `ZAI_API_KEY=...` (or `ZHIPU_API_KEY` / `GLM_API_KEY`)
  - `AGENT_PYTHON=python` (Windows) or `python3` (macOS/Linux)

Then install python deps for member D's code:

```bash
pip install zai
# plus any other deps your Agent.py needs
```

This repo already ships:
- `python/Agent.py` (member D code)
- `python/agent_runner.py` (CLI wrapper: reads stdin JSON, prints analyzer.run(rawText) result)

The backend will spawn:

```bash
python python/agent_runner.py
```

and parse its stdout JSON.

#### Option B: **http mode** (if you wrap agent as a web service)

- Set:
  - `AGENT_MODE=http`
  - `AGENT_URL=http://127.0.0.1:8001/agent` (example)

In this mode, backend POSTs `{ query, context, snippets }` to `AGENT_URL`.

## 3) Endpoints

### Health

- `GET /health`

### Search (debug / agent helper)

- `POST /api/search`
- Body:

```json
{ "query": "某品牌咖啡涨价", "count": 20, "market": "zh-CN" }
```

- Response:

```json
{
  "code": 200,
  "data": {
    "query": "...",
    "results": [
      {
        "title": "...",
        "snippet": "...",
        "url": "...",
        "sourceName": "...",
        "datePublished": "..."
      }
    ]
  }
}
```

### Analyze (frontend main API)

- `POST /api/analyze`
- Matches the PRD response shape.

Behavior:
- If agent is configured (`AGENT_MODE=http` + `AGENT_URL`, or `AGENT_MODE=process` + `ZAI_API_KEY`), it will call agent and return its structured result.
- Otherwise, it returns a simple heuristic fallback (to unblock frontend联调).

## 4) Curl examples

```bash
curl -s http://localhost:8787/health

curl -s http://localhost:8787/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"某品牌咖啡涨价"}'

curl -s http://localhost:8787/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"query":"某品牌咖啡涨价","context":{"currentUrl":"https://example.com","timestamp":"2026-01-29T10:00:00Z"}}'
```
