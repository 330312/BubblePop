import React, { useEffect, useState } from 'react';
import { AnalysisResult } from '../../types';
import Timeline from './Timeline';
import StancesPanel from './StancesPanel';
import RelatedEvents from './RelatedEvents';

interface SidebarProps {
  selection: string;
  analysisResult: AnalysisResult | null;
  sources?: AnalysisResult['sources'];
  statusMessage?: string;
  isLoading: boolean;
  errorMessage?: string | null;
  onRefetch: () => void;
  forceOpenTick?: number;
  onOpenSettings?: () => void;
  onClearSelection?: () => void;
  onValidateDdg?: () => Promise<{ ok: boolean; message?: string }>;
  onValidateAgentKey?: (key: string) => Promise<{ ok: boolean; message?: string }>;
  agentApiKey?: string;
  ddgRegion?: string;
  onChangeDdgRegion?: (region: string) => void;
}

const DDG_REGION_OPTIONS = [
  { value: 'cn-zh', label: '中国内地' },
  { value: 'hk-tzh', label: '中国港澳' },
  { value: 'tw-tzh', label: '中国台湾' },
  { value: 'us-en', label: '美国' },
  { value: 'uk-en', label: '欧洲' },
  { value: 'wt-wt', label: '全球' }
];

const Sidebar: React.FC<SidebarProps> = ({
  selection,
  analysisResult,
  sources,
  statusMessage,
  isLoading,
  errorMessage,
  onRefetch,
  forceOpenTick,
  onOpenSettings,
  onClearSelection,
  onValidateDdg,
  onValidateAgentKey,
  agentApiKey,
  ddgRegion,
  onChangeDdgRegion
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [ddgMsg, setDdgMsg] = useState('');
  const [agentKeyInput, setAgentKeyInput] = useState('');
  const [agentUrlMsg, setAgentUrlMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSummary, setShowSummary] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showStances, setShowStances] = useState(false);
  const [showRelated, setShowRelated] = useState(false);

  useEffect(() => {
    setAgentKeyInput(agentApiKey || '');
  }, [agentApiKey]);

  // 外部强制打开信号（点击扩展图标时触发）
  useEffect(() => {
    if (forceOpenTick !== undefined) {
      setIsOpen(true);
    }
  }, [forceOpenTick]);

  useEffect(() => {
    if (isLoading && sources && sources.length > 0) {
      setShowSources(true);
    }
  }, [isLoading, sources?.length]);

  const toggleSource = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderSection = (
    title: string,
    open: boolean,
    onToggle: () => void,
    children: React.ReactNode
  ) => (
    <div className="mb-4 bp-panel">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-semibold"
        onClick={onToggle}
      >
        <span className="bp-text">{title}</span>
        <span className="text-xs bp-chip px-2 py-0.5">{open ? '收起' : '展开'}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );

  const renderSources = (list?: AnalysisResult['sources']) => {
    const safeList = list || [];
    return (
      <div className="mb-6 bp-panel">
        <button
          className="w-full flex items-center justify-between p-3 text-sm font-medium"
          onClick={() => setShowSources((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <span className="bp-text">搜索结果</span>
            <span className="text-xs bp-muted">
              {safeList.length > 0 ? `${safeList.length} 条` : '暂无'}
            </span>
          </span>
          <span className="text-xs bp-chip px-2 py-0.5">{showSources ? '收起' : '展开'}</span>
        </button>
        {showSources && (
          <div className="p-3 space-y-3">
            {safeList.length === 0 ? (
              <div className="text-xs bp-muted">暂无搜索结果</div>
            ) : (
              safeList.map((s, idx) => {
                const id = s.url ? `u:${s.url}` : `i:${idx}`;
                const expanded = !!expandedSources[id];
                return (
                  <div key={`${s.url}-${idx}`} className="p-3 bp-panel-soft">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm font-semibold bp-text">{s.title}</div>
                      <button
                        className="bp-btn-ghost text-xs"
                        onClick={() => toggleSource(id)}
                      >
                        {expanded ? '收起' : '展开'}
                      </button>
                    </div>
                    {s.snippet && (
                      <div className={`text-xs bp-muted ${expanded ? '' : 'line-clamp-2'}`}>
                        {s.snippet}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs bp-muted">
                      {s.sourceName && <span className="bp-chip px-2 py-0.5">{s.sourceName}</span>}
                      {s.datePublished && <span>{s.datePublished}</span>}
                    </div>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bp-link mt-1 inline-block"
                      >
                        查看原文 →
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const sourceList = (analysisResult?.sources || sources) || [];
  const hasSources = sourceList.length > 0;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-1/2 right-0 transform -translate-y-1/2 bp-btn rounded-l-lg shadow-lg transition-colors z-50"
      >
        ›
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-96 bp-root bp-shell shadow-2xl flex flex-col z-50 border-l border-gray-200">
      {/* 顶部工具栏 */}
      <div className="p-4 bp-hero">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold bp-text">
            划词搜新闻
          </h1>
          <button
            onClick={() => setIsOpen(false)}
            className="bp-btn-ghost"
          >
            ✕
          </button>
        </div>

        {/* 选中文本区域 */}
        <div className="p-3 bp-panel-soft">
          {selection ? (
            <div className="flex items-start gap-2">
              <div className="flex-1 text-sm bp-text line-clamp-2">
                当前选中：{selection}
              </div>
              {onClearSelection && (
                <button
                  onClick={onClearSelection}
                  className="bp-btn-ghost text-xs"
                >
                  取消选中
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm bp-muted">请选中文本以触发分析</div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onRefetch}
              disabled={isLoading || !selection}
              className="bp-btn text-sm disabled:opacity-50"
            >
              {isLoading ? '分析中...' : '重新分析'}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="bp-btn-outline text-sm"
            >
              设置
            </button>
          </div>
          {statusMessage && (
            <div className="mt-2 text-xs bp-muted">{statusMessage}</div>
          )}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {analysisResult?.meta?.ddg && !analysisResult.meta.ddg.ok && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            DDG 搜索失败：{analysisResult.meta.ddg.message}
          </div>
        )}
        {analysisResult?.meta?.agent && !analysisResult.meta.agent.ok && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Agent 失败：{analysisResult.meta.agent.message}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4">
            <div className="bp-panel p-3">
              <div className="text-sm font-semibold bp-text mb-2">处理进度</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`bp-step-dot ${hasSources ? 'bp-step-done' : 'bp-step-active'}`} />
                  <span className="bp-text">搜索新闻</span>
                  <span className="text-xs bp-muted">
                    {hasSources ? `已获取 ${sourceList.length} 条` : '进行中'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`bp-step-dot ${hasSources ? 'bp-step-active' : ''}`} />
                  <span className="bp-text">结构化分析</span>
                  <span className="text-xs bp-muted">{hasSources ? '处理中' : '等待搜索'}</span>
                </div>
              </div>
              {statusMessage && (
                <div className="mt-3 text-xs bp-muted">{statusMessage}</div>
              )}
            </div>
            {hasSources && renderSources(sourceList)}
            <div className="bp-panel p-3 space-y-3">
              <div className="bp-skeleton h-3 w-3/4"></div>
              <div className="bp-skeleton h-3 w-2/3"></div>
              <div className="bp-skeleton h-3 w-1/2"></div>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        ) : analysisResult ? (
          <>
            {/* 事件摘要 */}
            {renderSection('事件摘要', showSummary, () => setShowSummary((v) => !v), (
              <p className="text-sm bp-muted leading-relaxed">{analysisResult.summary}</p>
            ))}

            {/* 搜索结果折叠区 */}
            {renderSources(sourceList)}

            {analysisResult.timeline.length > 0 && (
              renderSection(
                analysisResult.meta?.mode === 'news' ? '新闻列表' : '时间脉络',
                showTimeline,
                () => setShowTimeline((v) => !v),
                <Timeline events={analysisResult.timeline} />
              )
            )}

            {analysisResult.stances.length > 0 && (
              renderSection('立场分析', showStances, () => setShowStances((v) => !v), (
                <StancesPanel stances={analysisResult.stances} />
              ))
            )}

            {analysisResult.relatedEvents.length > 0 && (
              renderSection('关联事件', showRelated, () => setShowRelated((v) => !v), (
                <RelatedEvents events={analysisResult.relatedEvents} />
              ))
            )}
          </>
        ) : sources && sources.length > 0 ? (
          <div>{renderSources(sourceList)}</div>
        ) : (
          <div className="flex items-center justify-center h-full bp-muted">
            选中页面中的文本以启动叙事分析
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed top-0 right-0 h-screen w-96 z-50 bg-black/40">
          <div className="p-4">
            <div className="bp-panel p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold bp-text">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="bp-btn-ghost"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2 bp-text">DuckDuckGo 服务</div>
                <div className="mb-2">
                  <select
                    value={ddgRegion || 'cn-zh'}
                    onChange={(e) => onChangeDdgRegion?.(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {DDG_REGION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={saving || !onValidateDdg}
                    onClick={async () => {
                      if (!onValidateDdg) return;
                      setSaving(true);
                      try {
                        const res = await onValidateDdg();
                        setDdgMsg(res?.message || (res?.ok ? '服务可用' : '服务不可用'));
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="bp-btn text-sm disabled:opacity-50"
                  >
                    测试 DDG 服务
                  </button>
                  {ddgMsg && (
                    <div className={`text-xs ${ddgMsg.includes('可用') ? 'text-green-700' : 'text-red-600'}`}>
                      {ddgMsg}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2 bp-text">GLM API Key</div>
                <input
                  type="text"
                  value={agentKeyInput}
                  onChange={(e) => setAgentKeyInput(e.target.value)}
                  placeholder="请输入 GLM API Key"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    disabled={saving || !onValidateAgentKey}
                    onClick={async () => {
                      if (!onValidateAgentKey) return;
                      if (!agentKeyInput.trim()) {
                        setAgentUrlMsg('请输入 GLM API Key');
                        return;
                      }
                      setSaving(true);
                      try {
                        const res = await onValidateAgentKey(agentKeyInput.trim());
                        setAgentUrlMsg(res?.message || (res?.ok ? 'Key 可用' : '验证失败'));
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="bp-btn text-sm disabled:opacity-50"
                  >
                    验证并保存
                  </button>
                  {agentUrlMsg && (
                    <div className={`text-xs ${agentUrlMsg.includes('可用') || agentUrlMsg.includes('成功') ? 'text-green-700' : 'text-red-600'}`}>
                      {agentUrlMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
