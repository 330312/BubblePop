import React, { useState } from 'react';

interface Stance {
  party: string;
  viewpoint: string;
}

interface StancesPanelProps {
  stances: Stance[];
}

const StancesPanel: React.FC<StancesPanelProps> = ({ stances }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-3">
      {stances.map((stance, index) => (
        <div 
          key={index}
          className="p-3 bp-panel-soft transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="bp-dot" />
              <span className="bp-chip px-2 py-0.5 text-xs">{stance.party}</span>
            </div>
            <button className="bp-btn-ghost text-xs" onClick={() => toggle(index)}>
              {expanded[index] ? '收起' : '展开'}
            </button>
          </div>
          <p className={`text-sm bp-muted leading-relaxed ${expanded[index] ? '' : 'line-clamp-2'}`}>
            {stance.viewpoint}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StancesPanel;
