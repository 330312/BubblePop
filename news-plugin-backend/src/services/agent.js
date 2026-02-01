import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { AppError } from '../utils/error.js';

function safeJsonParse(maybeJson) {
  if (typeof maybeJson !== 'string') return maybeJson;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function extractJsonFromText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function getAgentMode() {
  const m = (process.env.AGENT_MODE || '').trim().toLowerCase();
  if (m) return m;
  if (process.env.AGENT_URL) return 'http';
  // default to process mode if runner exists
  const runner = path.resolve(process.cwd(), process.env.AGENT_RUNNER || 'python/agent_runner.py');
  if (fs.existsSync(runner)) return 'process';
  return 'none';
}

export function isAgentConfigured() {
  const mode = getAgentMode();
  if (mode === 'http') return Boolean(process.env.AGENT_URL);

  if (mode === 'process') {
    const runner = path.resolve(process.cwd(), process.env.AGENT_RUNNER || 'python/agent_runner.py');
    const hasRunner = fs.existsSync(runner);
    const hasKey = Boolean(process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY);
    return hasRunner && hasKey;
  }

  return false;
}

async function agentAnalyzeHttp({ query, context, snippets }) {
  const url = process.env.AGENT_URL;
  if (!url) {
    throw new AppError(500, 'AGENT_URL not configured');
  }

  const timeout = Number(process.env.AGENT_TIMEOUT_MS || 25000);

  let resp;
  try {
    resp = await axios.post(
      url,
      {
        query,
        context,
        snippets
      },
      {
        timeout,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    throw new AppError(502, `Agent request failed: ${err?.message || 'unknown error'}`);
  }

  const data = resp.data;

  // If the python side wraps it, try to unwrap a few common patterns.
  if (data?.data && (data.data.summary || data.data.timeline)) return data.data;
  if (data?.result && (data.result.summary || data.result.timeline)) return data.result;

  const parsed = safeJsonParse(data);
  if (parsed && (parsed.summary || parsed.timeline)) return parsed;

  // Last resort: return raw
  if (data && (data.summary || data.timeline)) return data;

  throw new AppError(502, 'Agent response format not recognized');
}

async function agentAnalyzeProcess({ rawText }) {
  const pythonCmd = process.env.AGENT_PYTHON || process.env.PYTHON || 'python';
  const runner = path.resolve(process.cwd(), process.env.AGENT_RUNNER || 'python/agent_runner.py');
  const timeout = Number(process.env.AGENT_TIMEOUT_MS || 45000);

  if (!fs.existsSync(runner)) {
    throw new AppError(500, `Agent runner not found: ${runner}`);
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [runner], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AppError(504, 'Agent process timeout'));
    }, timeout);

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new AppError(502, `Agent process spawn failed: ${err?.message || 'unknown error'}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new AppError(502, `Agent process exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      // analyzer.run returns a JSON string (with wrapper {code, data:{...}})
      let parsed = safeJsonParse(stdout) || extractJsonFromText(stdout);
      if (!parsed) {
        reject(new AppError(502, `Failed to parse agent output. stderr=${stderr.trim().slice(0, 500)}`));
        return;
      }

      // unwrap member D's format: { code: 200, data: { summary, timeline, stances, relatedEvents } }
      if (typeof parsed.code === 'number') {
        if (parsed.code !== 200) {
          const errDetail = parsed.data ? JSON.stringify(parsed.data).slice(0, 500) : '';
          reject(new AppError(502, `Agent returned error code ${parsed.code}: ${parsed.msg || 'unknown'} ${errDetail}`));
          return;
        }
        if (parsed.data) {
          resolve(parsed.data);
          return;
        }
      }

      // if it's already the data
      if (parsed.summary || parsed.timeline) {
        resolve(parsed);
        return;
      }

      reject(new AppError(502, 'Agent response format not recognized'));
    });

    child.stdin.write(JSON.stringify({ rawText }));
    child.stdin.end();
  });
}

/**
 * Calls member D agent.
 * - mode=http: POST to AGENT_URL
 * - mode=process: spawn python runner (python/agent_runner.py) which imports python/Agent.py
 */
export async function agentAnalyze({ query, context, snippets, rawText }) {
  const mode = getAgentMode();

  if (mode === 'http') {
    return agentAnalyzeHttp({ query, context, snippets });
  }

  if (mode === 'process') {
    if (!rawText) {
      throw new AppError(500, 'rawText is required for process mode');
    }
    return agentAnalyzeProcess({ rawText });
  }

  throw new AppError(500, 'Agent not configured');
}
