import React, { useState } from 'react';

interface RelatedEvent {
  eventName: string;
  reason: string;
}

interface RelatedEventsProps {
  events: RelatedEvent[];
}

const RelatedEvents: React.FC<RelatedEventsProps> = ({ events }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div 
          key={index}
          className="p-3 bp-panel-soft transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="bp-dot" />
              <div className="flex-1">
                <h4 className="font-medium bp-text">{event.eventName}</h4>
                <p className={`text-sm bp-muted mt-1 ${expanded[index] ? '' : 'line-clamp-2'}`}>
                  关联原因：{event.reason}
                </p>
              </div>
            </div>
            <button
              className="bp-btn-ghost text-xs"
              onClick={() => toggle(index)}
            >
              {expanded[index] ? '收起' : '展开'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RelatedEvents;
