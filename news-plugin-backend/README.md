# BubblePop Backend (Express)

后端负责：
- 聚合搜索（DDG + GDELT）
- 候选去重排序
- 调用 Agent（可选）或 fallback
- 输出结构化 JSON

---

## 启动

```bash
cd news-plugin-backend
cp .env.example .env
# 填写本地环境变量

npm i
npm run dev
```

默认监听 `http://localhost:8787`。

---

## 环境变量
详见 `.env.example`。常用项：

### 搜索
- `DDG_REGION`：`cn-zh` / `hk-tzh` / `tw-tzh` / `us-en` / `uk-en` / `wt-wt`
- `DDG_BACKEND`：`auto`
- `DDG_TIMEOUT_MS`
- `GDELT_TIMEOUT_MS`
- `GDELT_INSECURE`：TLS 被拦截时设为 `1`
- `SEARCH_PYTHON`：Python 路径

### Agent
- `AGENT_MODE=process`（推荐）
- `AGENT_RUNNER=python/agent_runner.py`
- `AGENT_TIMEOUT_MS`
- `AGENT_DEBUG=1`：输出智能体原始输出到日志
- `ZAI_API_KEY` / `ZHIPU_API_KEY` / `GLM_API_KEY`：任选其一

---

## 接口

### `GET /health`

### `POST /api/search`
```json
{ "query": "某品牌咖啡涨价", "count": 20, "region": "cn-zh" }
```

### `POST /api/analyze`
```json
{
  "query": "某品牌咖啡涨价",
  "region": "cn-zh",
  "context": {"currentUrl":"https://example.com"}
}
```

---

## 测试命令

```bash
curl -s http://localhost:8787/health

curl -s -X POST http://localhost:8787/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"王楚钦亚洲杯复出首战速胜","region":"cn-zh"}'

curl -s -X POST http://localhost:8787/api/analyze \
  -H 'content-type: application/json' \
  -H 'x-agent-key: <YOUR_GLM_KEY>' \
  -d '{"query":"王楚钦亚洲杯复出首战速胜","region":"cn-zh","context":{"currentUrl":"https://example.com"}}'
```

调试模式（可选）：  
```bash
GDELT_INSECURE=1 AGENT_DEBUG=1 npm run dev
```

---

## 常见问题
- **DDG 无结果**：检查 Python 依赖与 `SEARCH_PYTHON`
- **GDELT TLS 错误**：设置 `GDELT_INSECURE=1`
- **Agent 超时**：增大 `AGENT_TIMEOUT_MS` 或减少输入文本
