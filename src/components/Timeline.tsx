import React, { useState } from 'react';
import { TimelineEvent } from '../../types';

interface TimelineProps {
  events: TimelineEvent[];
}

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bp-divider" />
      <div className="space-y-6">
        {events.map((event, index) => {
          const isOpen = !!expanded[index];
          return (
            <div key={index} className="relative flex items-start gap-3">
              <span className={`bp-dot ${event.isReversal ? 'bp-dot-warn' : ''}`} />
              <div className="flex-1 bp-panel-soft p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs bp-muted">{event.date}</span>
                  <button className="bp-btn-ghost text-xs" onClick={() => toggle(index)}>
                    {isOpen ? '收起' : '展开'}
                  </button>
                </div>
                <h3 className="text-sm font-semibold bp-text mb-1">{event.title}</h3>
                <p className={`text-sm bp-muted mb-3 ${isOpen ? '' : 'line-clamp-2'}`}>
                  {event.snippet}
                </p>
                {event.tags && event.tags.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    {event.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="bp-chip px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs bp-muted">来源：{event.sourceName || '未知'}</div>
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bp-link mt-1 inline-block"
                  >
                    查看原文 →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
