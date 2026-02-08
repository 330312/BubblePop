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

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  sourceName?: string;
  datePublished?: string;
}

export interface AnalysisResult {
  summary: string;
  timeline: TimelineEvent[];
  stances: Stance[];
  relatedEvents: RelatedEvent[];
  sources?: SearchResult[];
  meta?: {
    ddg?: { ok: boolean; message?: string };
    agent?: { ok: boolean; message?: string; used?: boolean };
    mode?: 'analysis' | 'news';
  };
}

export interface AnalysisRequest {
  query: string;
  context: {
    currentUrl: string;
    timestamp: string;
  };
}
