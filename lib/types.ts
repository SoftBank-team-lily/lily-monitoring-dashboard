/**
 * 대시보드 ↔ Observability API 계약.
 * docs/api-contract.md와 같은 내용이다. 필드를 바꿀 때는 두 곳을 함께 고친다.
 *
 * 공통 규칙
 * - 시각은 ISO-8601 UTC 문자열 ("2026-09-30T10:04:12Z")
 * - 에러율은 0~1 비율 (3.1% → 0.031)
 * - 상태(Status)와 조치 문구(hint)는 백엔드가 계산한다. 화면은 임계값을 다시 계산하지 않는다
 *   (Logging 모듈의 위험도 판정과 패널 색이 어긋나지 않게)
 */

/** ok 정상 · warn 주의 · bad 위험 · unknown 판단 보류(요청이 너무 적음) */
export type Status = 'ok' | 'warn' | 'bad' | 'unknown';

/** stable = 지금 트래픽 대부분을 받는 기존 버전, canary = 시험 중인 새 버전 */
export type Role = 'stable' | 'canary';

export type Range = '15m' | '1h';

export interface PanelState {
  status: Status;
  /** 한 줄 조치 문구. 정상이면 null */
  hint: string | null;
}

export interface VersionSummary {
  /** APP_VERSION */
  version: string;
  /** APP_COLOR (blue | green) */
  color: string;
  role: Role;
  /** 요약 구간(window) 안의 요청 수 */
  requests: number;
  errorRate: number;
  /** 표본이 없으면 null */
  p95Ms: number | null;
  /** 이 버전의 지표별 상태 (어느 버전이 문제인지 표시할 때 사용) */
  statuses: { requests: Status; errorRate: Status; p95Ms: Status };
}

export interface MetricSeries {
  requests: (number | null)[];
  errorRate: (number | null)[];
  p95Ms: (number | null)[];
}

/** GET /api/apps/{app}/metrics?range=15m */
export interface AppMetrics {
  app: string;
  generatedAt: string;
  /** 요약 구간. 예: "5m" */
  window: string;
  /** 앱 전체 상태 = 가장 나쁜 패널 상태 */
  status: Status;
  /** 가장 급한 한 줄 조치 문구 */
  hint: string | null;
  /** 버전별 트래픽 가중치(%). CI/CD 연동 전에는 null이어도 된다 */
  traffic: { version: string; color: string; role: Role; weight: number }[] | null;
  versions: VersionSummary[];
  panels: { requests: PanelState; errorRate: PanelState; p95Ms: PanelState };
  thresholds: {
    errorRate: { warn: number; bad: number };
    p95Ms: { warn: number; bad: number };
    minRequests: number;
  };
  /** 시계열. timestamps와 각 배열의 길이가 같아야 한다. 그 시점에 없던 버전은 null */
  series: { stepSeconds: number; timestamps: string[]; byVersion: Record<string, MetricSeries> };
}

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogFilter = 'ALL' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  version: string | null;
  color: string | null;
  pod: string;
  /** 토큰·비밀번호는 백엔드에서 가려서 보낸다 */
  message: string;
  /** 예외 클래스와 메시지 첫 줄 (스택 전체는 보내지 않는다) */
  exception: string | null;
  traceId: string | null;
}

/** GET /api/apps/{app}/logs?limit=50&level=WARN (최신순) */
export interface AppLogs {
  app: string;
  items: LogEntry[];
  nextCursor: string | null;
}

export interface ServerMetrics {
  name: string;
  role: 'server' | 'worker';
  status: Status;
  hint: string | null;
  cpuPercent: number;
  memory: { usedBytes: number; totalBytes: number; percent: number };
  pods: number;
  series?: { stepSeconds: number; timestamps: string[]; cpuPercent: number[]; memoryPercent: number[] };
}

/** GET /api/servers?range=15m */
export interface Servers {
  generatedAt: string;
  servers: ServerMetrics[];
}
