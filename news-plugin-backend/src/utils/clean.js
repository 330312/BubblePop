// Basic text cleaning for Bing snippets.
// Goal: remove useless characters/ads/HTML so the LLM sees higher-signal text.

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_TAGS = /<[^>]*>/g;

const AD_PATTERNS = [
  /\bSponsored\b/gi,
  /\bAd\b/gi,
  /广告/gi,
  /推广/gi,
  /点击查看/gi,
  /Read more/gi
];

export function cleanText(input) {
  if (!input) return '';
  let t = String(input);

  // Strip HTML + control chars
  t = t.replace(HTML_TAGS, ' ');
  t = t.replace(CONTROL_CHARS, ' ');

  // Remove obvious ad strings
  for (const p of AD_PATTERNS) t = t.replace(p, ' ');

  // Normalize whitespace
  t = t.replace(/\s+/g, ' ').trim();

  // Bing often returns ellipsis; keep but normalize
  t = t.replace(/…+/g, '…');

  return t;
}
