import React, { useState, useEffect } from 'react';
import { TimelineEvent, Stance, RelatedEvent } from '../types/analysis';
import Timeline from './timeline/Timeline';
import StancesPanel from './StancesPanel';
import RelatedEvents from './RelatedEvents';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    summary: string;
    timeline: TimelineEvent[];
    stances: Stance[];
    relatedEvents: RelatedEvent[];
  } | null>(null);

  // 模拟数据（实际开发中替换为API调用）
  const mockData = {
    summary: "某公司因原材料上涨宣布涨价，引发消费者不满和监管介入",
    timeline: [
      {
        date: "2025-12-01",
        title: "事件起因：某公司发布新规",
        snippet: "某公司发布公告称，由于原材料成本上涨，将于12月10日起对全线产品提价10%",
        sourceName: "新京报",
        url: "https://example.com/news/1",
        tags: ["企业官方"]
      },
      {
        date: "2025-12-05",
        title: "反转：监管部门介入",
        snippet: "市监局表示已立案调查，要求企业提供成本上涨的详细数据证明",
        sourceName: "央视新闻",
        url: "https://example.com/news/2",
        tags: ["监管机构"],
        isReversal: true
      }
    ],
    stances: [
      {
        party: "企业方",
        viewpoint: "强调是成本原因导致涨价，属于市场正常行为"
      },
      {
        party: "消费者",
        viewpoint: "普遍表示不满，认为是借机涨价割韭菜"
      }
    ],
    relatedEvents: [
      {
        eventName: "2023年某品牌类似涨价事件",
        reason: "同样因原材料上涨引发消费者集体投诉"
      }
    ]
  };

  // 模拟划词分析
  const simulateAnalysis = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAnalysisResult(mockData);
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    // 初始加载模拟数据
    simulateAnalysis();
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-1/2 right-0 transform -translate-y-1/2 bg-blue-600 text-white px-3 py-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
      >
        ›
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-96 bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-50 border-l border-gray-200 dark:border-gray-800">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">N</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            叙事脉络分析
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={simulateAnalysis}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? '分析中...' : '重新分析'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">正在分析事件脉络...</p>
            </div>
          </div>
        ) : analysisResult && (
          <>
            {/* 事件摘要 */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">事件摘要</h2>
              <p className="text-gray-700 dark:text-gray-300">{analysisResult.summary}</p>
            </div>

            {/* 时间轴 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">时间脉络</h2>
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  反转时间轴
                </button>
              </div>
              <Timeline events={analysisResult.timeline} />
            </div>

            {/* 立场分析 */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">立场分析</h2>
              <StancesPanel stances={analysisResult.stances} />
            </div>

            {/* 关联事件 */}
            {analysisResult.relatedEvents.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">关联事件</h2>
                <RelatedEvents events={analysisResult.relatedEvents} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;