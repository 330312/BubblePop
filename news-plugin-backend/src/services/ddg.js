import { spawn } from 'node:child_process';
import path from 'node:path';
import { AppError } from '../utils/error.js';

import fs from 'node:fs';

const ALLOWED_REGIONS = new Set(['cn-zh', 'hk-tzh', 'tw-tzh', 'us-en', 'uk-en', 'wt-wt']);

const ADULT_PATTERNS = [
  /吃瓜/i,
  /群P/i,
  /激情/i,
  /porn/i,
  /sex/i,
  /成人视频/i
];

const BLOCKED_URL_PATTERNS = [
  /:\/\/(www\.)?bing\.com\/?$/i,
  /watch-this\.online/i,
  /:\/\/[^/]*(91cg|51暗网|clknanm)\./i
];

function normalizeRegion(region) {
  const value = String(region || process.env.DDG_REGION || 'cn-zh').trim().toLowerCase();
  return ALLOWED_REGIONS.has(value) ? value : 'cn-zh';
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function extractQueryTerms(query) {
  const text = String(query || '');
  const cjkSegments = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const latin = Array.from(new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])).slice(0, 10);
  const strong = Array.from(
    new Set(cjkSegments.map((s) => normalizeForMatch(s)).filter((s) => s.length >= 2))
  ).slice(0, 10);

  const joined = cjkSegments.join('');
  const bigrams = [];
  for (let i = 0; i < joined.length - 1; i += 1) {
    const gram = joined.slice(i, i + 2);
    if (gram.trim()) bigrams.push(gram);
  }

  return {
    strong,
    latin,
    bigrams: Array.from(new Set(bigrams)).slice(0, 60)
  };
}

function buildRetryQuery(query) {
  const terms = extractQueryTerms(query);
  const parts = [...terms.strong.slice(0, 3), ...terms.latin.slice(0, 2)]
    .filter(Boolean)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Array.from(new Set(parts)).join(' ');
}

function isCleanResult(result) {
  const title = result?.title || '';
  const snippet = result?.snippet || '';
  const url = result?.url || '';
  if (!title && !snippet) return false;
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (BLOCKED_URL_PATTERNS.some((p) => p.test(url))) return false;
  const full = `${title} ${snippet} ${url}`;
  if (ADULT_PATTERNS.some((p) => p.test(full))) return false;
  return true;
}

function isRelevantResult(result, terms, minScore = 3) {
  if (!terms.strong.length && !terms.latin.length && !terms.bigrams.length) return true;

  const titleText = normalizeForMatch(result?.title || '');
  const snippetText = normalizeForMatch(result?.snippet || '');
  const text = `${titleText}${snippetText}${normalizeForMatch(result?.url || '')}`;
  if (!text) return false;

  let strongHits = 0;
  let titleStrongHits = 0;
  const shortStrong = terms.strong.filter((t) => normalizeForMatch(t).length <= 8);
  for (const t of terms.strong) {
    const normalized = normalizeForMatch(t);
    if (text.includes(normalized)) strongHits += 1;
    if (titleText.includes(normalized)) titleStrongHits += 1;
  }

  let latinHits = 0;
  let titleLatinHits = 0;
  for (const t of terms.latin) {
    if (text.includes(t)) latinHits += 1;
    if (titleText.includes(t)) titleLatinHits += 1;
  }

  let bigramHits = 0;
  for (const gram of terms.bigrams) {
    if (text.includes(gram)) bigramHits += 1;
  }

  const score = strongHits * 3 + latinHits * 2 + Math.min(bigramHits, 4);
  const requiresTitleHit = shortStrong.length > 0 || terms.latin.length > 0;
  if (requiresTitleHit && titleStrongHits + titleLatinHits === 0) return false;
  return score >= minScore;
}

function cleanResults(results, query, count, minScore = 3) {
  const terms = extractQueryTerms(query);
  const cleaned = [];
  const seen = new Set();

  for (const r of results || []) {
    const item = {
      title: r?.title || '',
      snippet: r?.snippet || '',
      url: r?.url || '',
      sourceName: r?.sourceName || '',
      datePublished: r?.datePublished || ''
    };

    if (!isCleanResult(item)) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    cleaned.push(item);
  }

  const strictRelevant = cleaned.filter((r) => isRelevantResult(r, terms, minScore));
  if (strictRelevant.length > 0) {
    return strictRelevant.slice(0, count);
  }

  // Soft fallback: still keep keyword-related items, but lower threshold to reduce empty results.
  const softRelevant = cleaned.filter((r) => isRelevantResult(r, terms, 1));
  if (softRelevant.length > 0) return softRelevant.slice(0, count);

  // Last resort: return raw cleaned results to avoid empty sources.
  return cleaned.slice(0, count);
}

export async function ddgSearch({ query, count = 20, region }) {
  const venvPythonLocal = path.resolve(process.cwd(), '.venv/bin/python');
  const venvPythonRepo = path.resolve(process.cwd(), '..', '.venv/bin/python');
  const pythonCmd =
    process.env.SEARCH_PYTHON ||
    process.env.PYTHON ||
    (fs.existsSync(venvPythonLocal)
      ? venvPythonLocal
      : fs.existsSync(venvPythonRepo)
        ? venvPythonRepo
        : 'python3');
  const runner = path.resolve(process.cwd(), 'python/ddg_search.py');
  const timeout = Number(process.env.DDG_TIMEOUT_MS || 12000);
  const backend = process.env.DDG_BACKEND || 'auto';
  const normalizedRegion = normalizeRegion(region);

  const runQuery = async (currentQuery) => {
    return await new Promise((resolve, reject) => {
      const child = spawn(pythonCmd, [runner], {
        env: { ...process.env, PYTHONWARNINGS: 'ignore' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new AppError(504, 'DDG search timeout'));
      }, timeout);

      child.stdout.on('data', (d) => {
        stdout += d.toString('utf8');
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new AppError(502, `DDG spawn failed: ${err?.message || 'unknown error'}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (stderr.trim()) {
          console.info(`[ddg] ${stderr.trim()}`);
        }
        if (code !== 0 && !stdout.trim()) {
          reject(new AppError(502, `DDG exited with code ${code}: ${stderr.trim()}`));
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(new AppError(502, `DDG output parse failed: ${stderr.trim().slice(0, 200)}`));
          return;
        }
        if (parsed?.error) {
          reject(new AppError(502, `${parsed.error}${stderr.trim() ? ` | ${stderr.trim()}` : ''}`));
          return;
        }
        resolve(parsed?.results || []);
      });

      child.stdin.write(JSON.stringify({ query: currentQuery, count, backend, region: normalizedRegion }));
      child.stdin.end();
    });
  };

  const firstResults = await runQuery(query);
  const firstCleaned = cleanResults(firstResults, query, count, 3);
  if (firstCleaned.length > 0) return firstCleaned;

  const retryQuery = buildRetryQuery(query);
  if (retryQuery && retryQuery !== query) {
    const secondResults = await runQuery(retryQuery);
    const secondCleaned = cleanResults(secondResults, retryQuery, count, 2);
    if (secondCleaned.length > 0) {
      console.info(`[ddg] retry query accepted: ${retryQuery}`);
      return secondCleaned;
    }
  }

  return [];
}
