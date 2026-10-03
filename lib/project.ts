/** lily-frontend /api/projects/:id/monitor의 공개 계약. 비밀값은 포함하지 않는다. */
export type Project = {
  id: string; name: string; repo: string; rootDir: string; target: 'cloud' | 'onprem';
  burst?: ProjectBurst | null;
  cloudPods?: { state: string; ready: number; replicas: number } | null;
  /** 등록할 때 고른 DB. 클라우드 → 온프레미스 전환에서 DB 위치를 고를 수 있는지 정한다 */
  database?: 'postgres' | 'mysql' | 'none' | null;
  /** 클라우드에서 내 PC 로 옮긴 앱 (공개 주소는 그대로) */
  movedFromCloud?: boolean;
  latestDeployment: null | {
    id: string; status: string; stage: string | null; url: string | null;
    message: string | null; logs: string[];
    /** onprem: 클라우드 앱을 내 PC 로 옮기는 배포 */
    move?: 'onprem' | null;
  };
};
export type ProjectBurst = {
  enabled: boolean; cloudPercent: number;
  agent: 'connected' | 'waiting' | 'outdated' | 'offline' | 'unknown' | 'other';
  live: null | {
    available: boolean; enabled: boolean; cloudPercent: number; warm: boolean; phase: string;
    home: 'ONPREM' | 'CLOUD' | 'MOVING_TO_CLOUD' | 'MOVING_TO_ONPREM' | 'UNKNOWN';
    movable: boolean; homeCancellable?: boolean; homeStep?: string; homeSteps?: string[];
    databaseMode?: string; databaseMovable?: boolean;
    localActive: number; remoteActive: number; overflowedTotal: number;
  };
};
export type ProjectPage = { items: Project[]; nextCursor: string | null };
export type Resource<T> = { state: 'ready'; data: T } | {
  state: 'unconfigured' | 'unavailable' | 'pending' | 'unsupported'; message: string;
};
export type Traffic = { requestsPerMinute: number; errorRate: number; avgLatencyMs: number; p95LatencyMs: number };
export type Metrics = { current: Traffic; series: (Traffic & { at: string })[] };
export type Pod = {
  name: string; phase: string; ready: boolean; restarts: number; slot: string | null;
  image: string | null; node: string | null; problem: string | null; lastRestartReason: string | null;
  cpuMillicores: number | null; memoryMiB: number | null;
};
export type App = {
  url: string | null; strategy: string; activeSlot: string | null; image: string | null; readyReplicas: number; replicas: number;
  deployments: { name: string; slot: string | null; image: string | null; readyReplicas: number; replicas: number }[];
};
export type Monitor = {
  project: Project; appName: string | null; namespace: string; generatedAt: string; window: string;
  status: Resource<{ level: string; message: string; reason: string; action: string; judgedAt: string }>;
  agent: Resource<{ connected: boolean; agentId: string | null; database: boolean } | null>;
  metrics: Resource<Metrics>; pods: Resource<Pod[]>; app: Resource<App>;
  logs: Resource<{ at: string; pod: string | null; slot: string | null; image: string | null; message: string }[]>;
  route: Resource<{ url: string; primaryHost: string; serviceName: string; servicePort: number;
    canary: { serviceName: string; servicePort: number; weight: number } | null }>;
  databases: Resource<{ id: string; engine: string; status: string }[]>;
};
export function safeHref(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
