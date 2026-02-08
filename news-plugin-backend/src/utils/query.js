function stripUiNoise(text) {
  let q = text || '';
  q = q.replace(/^当前选中[:：]\s*/i, '');
  q = q.replace(/围绕[“"](.+?)[”"]的新闻摘要梳理[\s\S]*$/i, '$1');
  q = q.replace(/（基于\s*DuckDuckGo[\s\S]*?）/gi, '');
  q = q.replace(/\(基于\s*DuckDuckGo[\s\S]*?\)/gi, '');
  q = q.replace(/\bCURRENT_URL\s*:\s*\S+/gi, ' ');
  q = q.replace(/\bTIMESTAMP\s*:\s*\S+/gi, ' ');
  q = q.replace(/https?:\/\/\S+/gi, ' ');
  return q;
}

function scoreClause(clause) {
  const cjkCount = (clause.match(/[\u4e00-\u9fff]/g) || []).length;
  const wordCount = (clause.match(/[A-Za-z0-9]{2,}/g) || []).length;
  return cjkCount * 2 + wordCount;
}

function pickBestClause(text) {
  const clauses = text
    .split(/[。！？!?，,；;:\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  if (!clauses.length) return text;

  const sorted = clauses.sort((a, b) => scoreClause(b) - scoreClause(a));
  return sorted[0] || text;
}

export function normalizeQuery(raw) {
  let q = typeof raw === 'string' ? raw : '';
  q = stripUiNoise(q);
  q = q.replace(/\s+/g, ' ').trim();
  q = q.replace(/[“”"'`]/g, '');
  q = q.replace(/[\|｜]\s*Yahoo[\s\S]*$/i, '');
  q = q.replace(/\b(yahoo|yahoo新闻|yahoo新聞)\b/gi, ' ');
  q = q.replace(/\s{2,}/g, ' ').trim();

  if (!q) return '';
  if (q.length > 120) q = pickBestClause(q);
  if (q.length > 120) q = q.slice(0, 120).trim();
  return q;
}
