#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const cwd = process.cwd();
const venvDir = path.join(cwd, '.venv');
const venvPython = path.join(venvDir, 'bin', 'python');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd });
}

try {
  // Require uv
  run('uv --version');

  if (!fs.existsSync(venvPython)) {
    run('uv venv .venv');
  }

  run(`uv pip install --python ${venvPython} ddgs typing-extensions zhipuai sniffio`);
} catch (err) {
  console.warn('[ensure-python-deps] skipped:', err.message || err);
}
