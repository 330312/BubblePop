// 划词监听工具函数
export const setupSelectionListener = (onSelection: (text: string) => void) => {
  let lastSelection = '';
  let timer: NodeJS.Timeout;

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const selectedText = selection.toString().trim();
    
    // 防止重复触发和空选择
    if (!selectedText || selectedText === lastSelection) return;
    
    // 至少选择5个字符
    if (selectedText.length < 5) return;
    
    // 防抖处理
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastSelection = selectedText;
      onSelection(selectedText);
    }, 300);
  };

  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('selectionchange', handleSelection);

  return () => {
    document.removeEventListener('mouseup', handleSelection);
    document.removeEventListener('selectionchange', handleSelection);
    clearTimeout(timer);
  };
};

// 划词高亮样式
export const injectSelectionStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .narrative-selection-highlight {
      background-color: rgba(59, 130, 246, 0.2) !important;
      cursor: pointer !important;
    }
    .narrative-selection-highlight:hover {
      background-color: rgba(59, 130, 246, 0.3) !important;
    }
  `;
  document.head.appendChild(style);
};