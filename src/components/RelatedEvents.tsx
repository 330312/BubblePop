import React from 'react';

interface RelatedEvent {
  eventName: string;
  reason: string;
}

interface RelatedEventsProps {
  events: RelatedEvent[];
}

const RelatedEvents: React.FC<RelatedEventsProps> = ({ events }) => {
  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div 
          key={index}
          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {event.eventName}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                关联原因：{event.reason}
              </p>
            </div>
            <span className="text-xs text-gray-500 mt-1">相关</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RelatedEvents;