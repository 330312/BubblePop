import { Router } from 'express';
import axios from 'axios';

import { ddgSearch } from '../services/ddg.js';
import { validateAgentKey } from '../services/agent.js';

export const validateRouter = Router();

validateRouter.post('/ddg', async (req, res) => {
  const region = typeof req.body?.region === 'string' ? req.body.region : undefined;
  const probeByRegion = {
    'cn-zh': '今日新闻',
    'hk-tzh': '香港 新闻',
    'tw-tzh': '台灣 新聞',
    'us-en': 'latest news',
    'uk-en': 'latest europe news',
    'wt-wt': 'world news'
  };
  const primaryProbe = probeByRegion[region || ''] || 'news';
  const probes = [primaryProbe, 'latest news', '今日新闻'];
  let lastErr;
  for (const query of probes) {
    try {
      const results = await ddgSearch({ query, count: 1, region });
      const suffix = results.length ? '' : '（探测词无结果）';
      return res.json({ ok: true, message: `DDG 服务可用${suffix}` });
    } catch (err) {
      lastErr = err;
    }
  }
  return res.status(400).json({
    ok: false,
    message: lastErr?.message || 'DDG 服务不可用'
  });
});

validateRouter.post('/agent', async (req, res) => {
  const agentUrl = req.body?.agentUrl;
  const apiKey = req.body?.apiKey;
  if (apiKey && typeof apiKey === 'string') {
    try {
      await validateAgentKey(apiKey.trim());
      return res.json({ ok: true, message: 'Agent Key 可用' });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        message: err?.message || 'Agent Key 校验失败'
      });
    }
  }
  if (agentUrl && typeof agentUrl === 'string') {
    try {
      await axios.post(
        agentUrl,
        { query: 'ping', context: {}, snippets: [] },
        { timeout: 6000, headers: { 'Content-Type': 'application/json' } }
      );
      return res.json({ ok: true, message: 'Agent 可用' });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        message: err?.message || 'Agent 校验失败'
      });
    }
  }
  return res.status(400).json({ ok: false, message: '缺少 Agent API Key' });
});
