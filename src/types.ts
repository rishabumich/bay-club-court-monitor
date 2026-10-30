export type LocatorSpec =
  | { by: "css"; value: string }
  | { by: "role"; role: string; name: string; exact?: boolean }
  | { by: "text"; value: string; exact?: boolean }
  | { by: "label"; value: string; exact?: boolean }
  | { by: "placeholder"; value: string; exact?: boolean }
  | { by: "testId"; value: string };

export type PageAction =
  | { type: "click"; target: LocatorSpec }
  | { type: "fill"; target: LocatorSpec; value: string }
  | { type: "select"; target: LocatorSpec; value: string }
  | { type: "press"; target: LocatorSpec; key: string }
  | { type: "waitFor"; target: LocatorSpec; state?: "attached" | "visible"; timeoutMs?: number }
  | { type: "wait"; milliseconds: number };

export interface FieldExtraction {
  selector?: string;
  attribute?: string;
  regex?: string;
  group?: number;
}

export interface WatchConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  actions: PageAction[];
  extraction: {
    itemSelector: string;
    availableTextRegex?: string;
    unavailableTextRegex?: string;
    fields: {
      date?: FieldExtraction;
      time?: FieldExtraction;
      court?: FieldExtraction;
      location?: FieldExtraction;
    };
  };
  match: {
    daysOfWeek?: string[];
    earliestTime?: string;
    latestTime?: string;
    includeTextRegex?: string;
    excludeTextRegex?: string;
  };
  bookingUrl: string;
}

export interface TimeWindow {
  earliestTime: string;
  latestTime?: string;
}

export interface BayClubSearch {
  enabled: boolean;
  windows: TimeWindow[];
}

export interface BayClubConfig {
  clubName: string;
  bookingUrl: string;
  timeZone: string;
  durationMinutes: 60;
  daysOfWeek: Array<"Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat">;
  singles: BayClubSearch;
  ballMachine: BayClubSearch;
}

export interface AppConfig {
  browser: {
    loginUrl: string;
    profileDir: string;
    headless: boolean;
    navigationTimeoutMs: number;
  };
  pollIntervalSeconds: number;
  notificationCooldownMinutes: number;
  safety: {
    blockedActionTextRegex: string;
    allowedActionTextRegexes: string[];
  };
  watches: WatchConfig[];
  bayClub?: BayClubConfig;
}

export interface Slot {
  watchId: string;
  watchName: string;
  rawText: string;
  date?: string;
  time?: string;
  court?: string;
  location?: string;
  bookingUrl: string;
  fingerprint: string;
}

export interface ObservationRecord {
  fingerprint: string;
  watchId: string;
  description: string;
  active: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastNotifiedAt?: string;
}

export interface MonitorState {
  schemaVersion: 1;
  observations: Record<string, ObservationRecord>;
  lastRuns: Record<string, { at: string; status: "ok" | "error"; detail?: string }>;
}
