function toISODate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

function inferTags(snippet = '', title = '') {
  const text = `${title} ${snippet}`;
  const tags = new Set();

  if (/(监管|市场监管|市监|监管部门|监管机构)/.test(text)) tags.add('监管机构');
  if (/(消费者|顾客|网友|用户|吐槽|投诉)/.test(text)) tags.add('消费者');
  if (/(公司|企业|官方|声明|发布|回应|公告|CEO|股东)/i.test(text)) tags.add('企业官方');
  if (/(专家|学者|研究|报告|智库|机构分析)/.test(text)) tags.add('专家');
  if (/(竞争对手|同行|竞品)/.test(text)) tags.add('竞争对手');

  return Array.from(tags);
}

function isReversal(snippet = '', title = '') {
  const text = `${title} ${snippet}`;
  return /(辟谣|澄清|否认|不实|fake news|rumor)/i.test(text);
}

function stancesFromTimeline(timeline) {
  const counts = new Map();
  for (const node of timeline) {
    for (const t of node.tags || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }

  // Take top 4 tags
  const topTags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);

  const viewpointByTag = {
    监管机构: '关注合规与社会影响，强调监管或调查进展。',
    企业官方: '强调自身解释与业务逻辑，通常给出原因或回应措施。',
    消费者: '表达使用体验与价格感受，常见不满或质疑。',
    专家: '提供原因分析、趋势判断或风险提示。',
    竞争对手: '从行业竞争角度评论或借势表达立场。'
  };

  return topTags.map((t) => ({
    party: t,
    viewpoint: viewpointByTag[t] || '表达与事件相关的核心观点。'
  }));
}

function containsCjk(text = '') {
  return /[\u4e00-\u9fff]/.test(text);
}

function ensureChinese(text = '', fallbackLabel = '') {
  const s = String(text || '').trim();
  if (!s) return '';
  if (containsCjk(s)) return s;
  return fallbackLabel ? `${fallbackLabel}（未翻译）` : '英文内容（未翻译）';
}

/**
 * A simple, non-LLM fallback so frontend can联调.
 * When AGENT_URL is configured, this will be replaced by the python agent output.
 */
export function buildFallbackAnalysis({ query, snippets }) {
  const timeline = (snippets || []).map((r) => {
    const date = toISODate(r.datePublished) || '背景信息';
    return {
      date,
      title: ensureChinese(r.title, '英文标题'),
      snippet: ensureChinese(r.snippet, '英文摘要'),
      sourceName: r.sourceName || '',
      url: r.url,
      tags: inferTags(r.snippet, r.title),
      ...(isReversal(r.snippet, r.title) ? { isReversal: true } : {})
    };
  });

  // Sort: background first, then by date
  timeline.sort((a, b) => {
    const aBg = a.date === '背景信息';
    const bBg = b.date === '背景信息';
    if (aBg && !bBg) return -1;
    if (!aBg && bBg) return 1;
    if (aBg && bBg) return 0;
    return a.date.localeCompare(b.date);
  });

  return {
    summary: `围绕“${query}”的新闻摘要梳理（基于 DuckDuckGo 搜索结果，非最终模型分析）。`,
    timeline: timeline.slice(0, 20),
    stances: stancesFromTimeline(timeline),
    relatedEvents: [],
    sources: snippets || []
  };
}
