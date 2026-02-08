import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';

import Sidebar from '../../src/components/Sidebar';
import { AnalysisResult } from '../../types';
import { analyzeText, searchNews, validateAgentKey, validateDdgService } from '../../api';
import { setupSelectionListener, injectSelectionStyles } from '../../selectionListener';
import '../../src/styles/tw-lite.css';

const DEFAULT_DDG_REGION = 'cn-zh';

// 事件触发器：用于响应“强制打开侧边栏”的指令（比如点击扩展图标）
const openListeners = new Set<() => void>();
let pendingOpen = false;
const emitOpen = () => {
  pendingOpen = true;
  openListeners.forEach((cb) => cb());
};
const onOpen = (cb: () => void) => {
  openListeners.add(cb);
  return () => openListeners.delete(cb);
};

const ContentApp: React.FC = () => {
  const [selection, setSelection] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sources, setSources] = useState<AnalysisResult['sources']>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [ddgStatus, setDdgStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceOpenTick, setForceOpenTick] = useState(0);
  const [agentApiKey, setAgentApiKey] = useState<string>('');
  const [ddgRegion, setDdgRegion] = useState<string>(DEFAULT_DDG_REGION);

  const runAnalysis = async (text: string) => {
    if (!text) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSources([]);
    setStatusMsg('正在搜索相关报道...');
    try {
      let found = [];
      let localDdgStatus: { ok: boolean; message?: string } | null = null;
      try {
        const searchRes = await searchNews(text, ddgRegion);
        found = searchRes?.data?.results || [];
        localDdgStatus = { ok: true, message: 'DDG 搜索成功' };
        setDdgStatus(localDdgStatus);
      } catch (err) {
        localDdgStatus = { ok: false, message: 'DDG 搜索失败，请稍后重试' };
        setDdgStatus(localDdgStatus);
        found = [];
      }
      setSources(found);
      setStatusMsg('正在分析内容...');

      const res = await analyzeText(
        text,
        window.location.href,
        undefined,
        found,
        ddgRegion,
        agentApiKey || undefined
      );
      if (localDdgStatus) {
        res.meta = { ...(res.meta || {}), ddg: localDdgStatus };
      }
      res.sources = found;
      setAnalysis(res);
    } catch (err) {
      setError('分析请求失败，请稍后重试');
      console.error('[BubblePop] analyze error', err);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  useEffect(() => {
    browser.storage.local.get(['agentApiKey', 'ddgRegion']).then((res) => {
      const key = typeof res?.agentApiKey === 'string' ? res.agentApiKey : '';
      const region = typeof res?.ddgRegion === 'string' ? res.ddgRegion : DEFAULT_DDG_REGION;
      setAgentApiKey(key);
      setDdgRegion(region);
    });
    injectSelectionStyles();
    const cleanup = setupSelectionListener((text) => {
      console.debug('[BubblePop] Selection captured:', text);
      setSelection(text);
      runAnalysis(text);
    });
    const offOpen = onOpen(() => setForceOpenTick((t) => t + 1));
    // 如果在 UI 挂载前就收到“打开”指令，这里补一次打开
    if (pendingOpen) {
      setForceOpenTick((t) => t + 1);
    }
    return () => {
      cleanup && cleanup();
      offOpen && offOpen();
    };
  }, []);

  return (
    <Sidebar
      selection={selection}
      analysisResult={analysis}
      sources={sources}
      statusMessage={statusMsg}
      isLoading={loading}
      errorMessage={error}
      onRefetch={() => runAnalysis(selection)}
      forceOpenTick={forceOpenTick}
      onOpenSettings={() => {
        // 由 Sidebar 内部状态控制弹窗
      }}
      onValidateDdg={async () => {
        const res = await validateDdgService(ddgRegion);
        return res;
      }}
      onValidateAgentKey={async (key) => {
        const res = await validateAgentKey(key);
        if (res?.ok) {
          await browser.storage.local.set({ agentApiKey: key.trim() });
          setAgentApiKey(key.trim());
        }
        return res;
      }}
      agentApiKey={agentApiKey}
      ddgRegion={ddgRegion}
      onChangeDdgRegion={async (region) => {
        setDdgRegion(region);
        await browser.storage.local.set({ ddgRegion: region });
      }}
      onClearSelection={() => {
        setSelection('');
        setAnalysis(null);
        setSources([]);
        setStatusMsg('');
        setDdgStatus(null);
        setError(null);
        setLoading(false);
      }}
    />
  );
};

const renderSidebarInto = (host: HTMLElement) => {
  host.dataset.bubblepopRoot = '1';
  const root = createRoot(host);
  root.render(<ContentApp />);
  return () => root.unmount();
};

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    // 防止重复注入
    if ((window as any).__bubblepopMounted) return;
    (window as any).__bubblepopMounted = true;

    const mount = () => {
      if ((window as any).__bubblepopUiMounted) return;
      createShadowRootUi(ctx, {
        name: 'narrative-sidebar',
        position: 'overlay',
        alignment: 'top-right',
        zIndex: 2147483647,
        anchor: 'body',
        append: 'last',
        onMount: (uiContainer) => {
          const container = document.createElement('div');
          // 兜底样式，避免 Tailwind 未加载导致不可见
          container.style.position = 'fixed';
          container.style.top = '0';
          container.style.right = '0';
          container.style.width = '380px';
          container.style.height = '100vh';
          container.style.zIndex = '2147483647';
          uiContainer.appendChild(container);

          return renderSidebarInto(container);
        }
      }).then((ui) => {
        try {
          ui.mount();
        } catch (err) {
          console.error('[BubblePop] shadow mount failed, fallback to body', err);
          // 如果 shadow mount 失败，退回到普通 DOM 注入
          const fallback = document.createElement('div');
          fallback.style.position = 'fixed';
          fallback.style.top = '0';
          fallback.style.right = '0';
          fallback.style.width = '380px';
          fallback.style.height = '100vh';
          fallback.style.zIndex = '2147483647';
          fallback.style.background = '#fff';
          document.body.appendChild(fallback);
          renderSidebarInto(fallback);
        }
        (window as any).__bubblepopUiMounted = true;
        // 挂载完成后若已有“打开”指令，触发一次展开
        if (pendingOpen) emitOpen();
      }).catch((err) => {
        console.error('[BubblePop] mount failed', err);
        // 兜底：直接注入到 body
        try {
          const fallback = document.createElement('div');
          fallback.style.position = 'fixed';
          fallback.style.top = '0';
          fallback.style.right = '0';
          fallback.style.width = '380px';
          fallback.style.height = '100vh';
          fallback.style.zIndex = '2147483647';
          fallback.style.background = '#fff';
          document.body.appendChild(fallback);
          renderSidebarInto(fallback);
          (window as any).__bubblepopUiMounted = true;
        } catch (fallbackErr) {
          console.error('[BubblePop] fallback mount failed', fallbackErr);
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }

    // 监听来自后台或点击事件的“打开侧边栏”消息
    browser.runtime.onMessage.addListener((msg) => {
      if (msg === 'bubblepop-open' || (msg && msg.type === 'bubblepop-open')) {
        // 如果还没挂载，先挂载再打开
        if (!(window as any).__bubblepopUiMounted) {
          // 标记请求
          pendingOpen = true;
          // 尝试立即挂载
          mount();
        }
        emitOpen();
      }
    });
  }
});
