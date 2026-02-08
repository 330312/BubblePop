import { defineConfig } from 'wxt';

export default defineConfig({
  // Ensure WXT looks for sources in project root (not ./dev).
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  dev: {
    server: {
      host: '127.0.0.1',
      port: 3005
    }
  },
  webExt: {
    browser: 'chrome'
  },
  manifest: {
    name: 'BubblePop Narrative',
    description: 'Analyze news narratives in-page with a sidebar.',
    version: '0.1.0',
    action: {
      default_title: 'BubblePop Narrative'
    },
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    }
  }
});
