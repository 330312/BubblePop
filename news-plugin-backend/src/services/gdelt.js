import axios from 'axios';
import https from 'node:https';

export async function gdeltSearch({ query, maxrecords = 10, timeoutMs = 8000 }) {
  const endpoint = 'https://api.gdeltproject.org/api/v2/doc/doc';
  const params = {
    query,
    mode: 'ArtList',
    maxrecords,
    format: 'json',
    sort: 'HybridRel'
  };

  const insecure =
    String(process.env.GDELT_INSECURE || '').trim().toLowerCase() === '1' ||
    String(process.env.GDELT_INSECURE || '').trim().toLowerCase() === 'true';
  const httpsAgent = insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  const resp = await axios.get(endpoint, {
    params,
    timeout: timeoutMs,
    validateStatus: (s) => s >= 200 && s < 300,
    ...(httpsAgent ? { httpsAgent } : {})
  });

  const articles = Array.isArray(resp.data?.articles) ? resp.data.articles : [];
  return articles.map((a) => ({
    title: a?.title || '',
    snippet: '',
    url: a?.url || '',
    sourceName: a?.domain || '',
    datePublished: a?.seendate || ''
  }));
}
