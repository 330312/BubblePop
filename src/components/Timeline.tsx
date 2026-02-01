import React, { useState } from 'react';

interface TimelineEvent {
  date: string;
  title: string;
  snippet: string;
  sourceName: string;
  url: string;
  tags: string[];
  isReversal?: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
}

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleNodeClick = (index: number, url: string) => {
    setSelectedIndex(index);
    window.open(url, '_blank');
  };

  return (
    <div className="relative">
      {/* 时间轴连接线 */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-700" />

      {/* 时间轴节点 */}
      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={index} className="relative flex items-start group">
            {/* 时间轴节点标记 */}
            <div
              className={`relative z-10 w-3 h-3 rounded-full border-2 
                ${event.isReversal 
                  ? 'border-red-500 bg-red-100 dark:bg-red-900' 
                  : 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                }
                ${selectedIndex === index ? 'ring-2 ring-offset-2 ring-blue-300' : ''}
                transition-all duration-200 cursor-pointer
              `}
              onClick={() => setSelectedIndex(index)}
            />

            {/* 节点内容卡片 */}
            <div
              className={`ml-6 p-4 rounded-lg border cursor-pointer flex-1 transition-all duration-200
                ${selectedIndex === index 
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              onClick={() => handleNodeClick(index, event.url)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 日期和标签行 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {event.date}
                </span>
                <div className="flex gap-1">
                  {event.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 标题（高亮反转事件） */}
              <h3 className={`text-base font-bold mb-2 ${
                event.isReversal 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-900 dark:text-white'
              }`}>
                {event.title}
              </h3>

              {/* 摘要 */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {event.snippet}
              </p>

              {/* 来源 */}
              <div className="text-xs text-gray-500 dark:text-gray-500">
                来源：{event.sourceName}
              </div>
            </div>

            {/* 悬停详情卡片 */}
            {hoveredIndex === index && (
              <div className="absolute left-full ml-4 top-0 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">{event.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{event.snippet}</p>
                <div className="text-xs text-gray-500">
                  <div>来源：{event.sourceName}</div>
                  <div>日期：{event.date}</div>
                  <a 
                    href={event.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                  >
                    查看原文 →
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;