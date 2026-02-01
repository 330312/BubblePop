import axios from 'axios';

import { cleanText } from '../utils/clean.js';

/**
 * Normalized search result used across the project.
 * @typedef {{
 *  title: string,
 *  snippet: string,
 *  url: string,
 *  sourceName?: string,
 *  datePublished?: string
 * }} SearchResult
 */

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/**
 * Parse Bocha API response
 * Response structure: { code, data: { webPages: { value: [...] } } }
 */
function parseBochaResponse(resp) {
  const arr = Array.isArray(resp?.data?.webPages?.value) ? resp.data.webPages.value : [];
  return arr.map((x) => {
    return {
      title: cleanText(x?.name || ''),
      snippet: cleanText(x?.snippet || x?.summary || ''),
      url: x?.url || '',
      sourceName: cleanText(x?.siteName || ''),
      datePublished: x?.datePublished || ''
    };
  });
}

/**
 * Fetch from Bocha Web Search API
 */
async function fetchBocha({ endpoint, query, count, freshness, key }) {
  const resp = await axios.post(
    endpoint,
    {
      query,
      count,
      freshness: freshness || 'noLimit',
      summary: true
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      timeout: 20_000
    }
  );
  return resp.data;
}

/**
 * Search via Bocha Web Search API.
 * Returns cleaned, deduped results.
 */
export async function bochaSearch({ query, count = 20, freshness = 'noLimit' }) {
  const key = process.env.BOCHA_API_KEY;
  if (!key) {
    throw new Error('Missing BOCHA_API_KEY in environment');
  }

  const endpoint = process.env.BOCHA_ENDPOINT || 'https://api.bochaai.com/v1/web-search';

  let results = [];

  const data = await fetchBocha({ endpoint, query, count, freshness, key });
  results = parseBochaResponse(data);

  // Filter invalid
  results = results
    .filter((r) => r.title && r.snippet && /^https?:\/\//.test(r.url))
    .map((r) => ({
      ...r,
      title: cleanText(r.title),
      snippet: cleanText(r.snippet)
    }));

  // Dedup by URL then by title
  results = uniqBy(results, (r) => r.url);
  results = uniqBy(results, (r) => r.title.toLowerCase());

  // Truncate to requested count
  return results.slice(0, count);
}

// Keep backward compatibility alias
export { bochaSearch as bingSearch };
