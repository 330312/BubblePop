// 直接放在src/types.ts中
export interface TimelineEvent {
  date: string;
  title: string;
  snippet: string;
  sourceName: string;
  url: string;
  tags: string[];
  isReversal?: boolean;
}

export interface Stance {
  party: string;
  viewpoint: string;
}

export interface RelatedEvent {
  eventName: string;
  reason: string;
}

export interface AnalysisResult {
  summary: string;
  timeline: TimelineEvent[];
  stances: Stance[];
  relatedEvents: RelatedEvent[];
}

export interface AnalysisRequest {
  query: string;
  context: {
    currentUrl: string;
    timestamp: string;
  };
}