import React from 'react';
import { createRoot } from 'react-dom/client';

const OptionsApp: React.FC = () => {
  return (
    <div style={{ maxWidth: 720, margin: '32px auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 12 }}>BubblePop 设置</h1>
      <p style={{ marginBottom: 16, color: '#555' }}>
        设置已迁移到侧边栏内弹窗。请打开侧边栏并点击“设置”。
      </p>
    </div>
  );
};

const root = createRoot(document.getElementById('app')!);
root.render(<OptionsApp />);
