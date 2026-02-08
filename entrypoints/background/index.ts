import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // 兼容不同运行时：browser.action 在某些环境下可能不存在
  const action =
    (browser as any)?.action ??
    (browser as any)?.browserAction ??
    (globalThis as any)?.chrome?.action ??
    (globalThis as any)?.chrome?.browserAction;
  if (!action?.onClicked) {
    console.error('[BubblePop] action API not available');
    return;
  }

  // 点击扩展图标时，通知当前标签页的内容脚本强制打开侧边栏
  action.onClicked.addListener(async (tab: { id?: number }) => {
    if (!tab.id) return;
    try {
      await browser.tabs.sendMessage(tab.id, 'bubblepop-open');
    } catch (err) {
      // 如果当前页还没注入内容脚本，尝试主动注入再发一次
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/content.js']
        });
        await browser.tabs.sendMessage(tab.id, 'bubblepop-open');
      } catch (injectErr) {
        console.debug('[BubblePop] open message failed', err);
        console.debug('[BubblePop] inject failed', injectErr);
      }
    }
  });
});
