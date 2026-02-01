import React from 'react';

interface Stance {
  party: string;
  viewpoint: string;
}

interface StancesPanelProps {
  stances: Stance[];
}

const StancesPanel: React.FC<StancesPanelProps> = ({ stances }) => {
  // 为不同利益方分配颜色
  const getPartyColor = (party: string) => {
    const colors: Record<string, string> = {
      '企业方': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      '消费者': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      '监管机构': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      '竞争对手': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    };
    return colors[party] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stances.map((stance, index) => (
        <div 
          key={index}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${
              stance.party === '企业方' ? 'bg-blue-500' :
              stance.party === '消费者' ? 'bg-green-500' :
              stance.party === '监管机构' ? 'bg-purple-500' :
              'bg-yellow-500'
            }`} />
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPartyColor(stance.party)}`}>
              {stance.party}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {stance.viewpoint}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StancesPanel;