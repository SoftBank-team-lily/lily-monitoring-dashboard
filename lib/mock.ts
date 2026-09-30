import type { AppLogs, AppMetrics, LogEntry, LogFilter, MetricSeries, PanelState, Range, Role, Servers, Status } from './types';

/**
 * API가 준비되기 전까지 쓰는 예시 데이터. 실제 API와 같은 형식이다.
 * ?scenario=bad (기본) 새 버전 에러율 급증 · healthy 정상 카나리 · single 새 버전 없음
 */
export type Scenario = 'bad' | 'healthy' | 'single';

const STEP_SECONDS = 30;
const GIB = 1024 ** 3;
const THRESHOLDS = { errorRate: { warn: 0.01, bad: 0.02 }, p95Ms: { warn: 400, bad: 800 }, minRequests: 20 };

/** 매번 같은 모양이 나오도록 난수 대신 사인파 조합 (-1 ~ 1) */
const wave = (i: number, seed: number) => (Math.sin(i * 0.7 + seed) + Math.sin(i * 0.23 + seed * 2)) / 2;
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;
const rank: Record<Status, number> = { unknown: 0, ok: 1, warn: 2, bad: 3 };
const worst = (...xs: Status[]) => xs.reduce((a, b) => (rank[b] > rank[a] ? b : a), 'ok' as Status);

function judge(value: number | null, t: { warn: number; bad: number }): Status {
  if (value === null) return 'unknown';
  return value >= t.bad ? 'bad' : value >= t.warn ? 'warn' : 'ok';
}

export function mockAppMetrics(app: string, range: Range, scenario: Scenario): AppMetrics {
  const n = range === '1h' ? 120 : 30;
  const now = Date.now();
  const timestamps = Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * STEP_SECONDS * 1000).toISOString());
  const canaryFrom = n - 12; // 새 버전은 6분 전에 올라왔다
  const bad = scenario === 'bad';

  const stable: MetricSeries = { requests: [], errorRate: [], p95Ms: [] };
  const canary: MetricSeries = { requests: [], errorRate: [], p95Ms: [] };
  for (let i = 0; i < n; i++) {
    const sample = i - n + 30; // Shared recent window across range choices.
    stable.requests.push(Math.round(170 + 20 * wave(sample, 1)));
    stable.errorRate.push(round(0.004 + 0.002 * wave(sample, 2), 4));
    stable.p95Ms.push(Math.round(185 + 15 * wave(sample, 3)));
    if (scenario === 'single' || i < canaryFrom) {
      canary.requests.push(null);
      canary.errorRate.push(null);
      canary.p95Ms.push(null);
      continue;
    }
    const k = i - canaryFrom;
    canary.requests.push(Math.round(19 + 3 * wave(sample, 4)));
    canary.errorRate.push(bad ? round(Math.min(0.006 + k * 0.0028, 0.034) + 0.002 * wave(sample, 5), 4) : round(0.004 + 0.002 * wave(sample, 6), 4));
    canary.p95Ms.push(bad ? Math.round(260 + k * 14 + 10 * wave(sample, 7)) : Math.round(190 + 12 * wave(sample, 8)));
  }

  // 최근 5분(10구간) 요약
  const last = (xs: (number | null)[]) => xs.slice(-10).filter((x): x is number => x !== null);
  const summarize = (s: MetricSeries) => {
    const req = last(s.requests);
    const requests = req.reduce((a, b) => a + b, 0);
    const errs = last(s.errorRate).map((r, j) => r * (req[j] ?? 0)).reduce((a, b) => a + b, 0);
    const p95 = last(s.p95Ms);
    return { requests, errorRate: requests ? round(errs / requests, 4) : 0, p95Ms: p95.length ? Math.round(p95.reduce((a, b) => a + b, 0) / p95.length) : null };
  };

  const versions: { version: string; color: string; role: Role; series: MetricSeries }[] = [{ version: 'v41', color: 'blue', role: 'stable', series: stable }];
  if (scenario !== 'single') versions.push({ version: 'v42', color: 'green', role: 'canary', series: canary });

  const summaries = versions.map((v) => {
    const s = summarize(v.series);
    const enough = s.requests >= THRESHOLDS.minRequests;
    return {
      version: v.version,
      color: v.color,
      role: v.role,
      ...s,
      statuses: {
        requests: enough ? ('ok' as Status) : ('unknown' as Status),
        errorRate: enough ? judge(s.errorRate, THRESHOLDS.errorRate) : ('unknown' as Status),
        p95Ms: enough ? judge(s.p95Ms, THRESHOLDS.p95Ms) : ('unknown' as Status),
      },
    };
  });

  const panel = (key: 'errorRate' | 'p95Ms'): PanelState => {
    const target = summaries.reduce((a, b) => (rank[b.statuses[key]] > rank[a.statuses[key]] ? b : a));
    const status = target.statuses[key];
    if (status === 'ok' || status === 'unknown') return { status, hint: null };
    const who = target.role === 'canary' ? `새 버전 ${target.version}` : `기존 버전 ${target.version}`;
    if (key === 'errorRate') {
      const pct = `${round(target.errorRate * 100, 1)}%`;
      return status === 'bad'
        ? { status, hint: `${who}의 에러율이 ${pct}로 기준(${THRESHOLDS.errorRate.bad * 100}%)을 넘었어요. 롤백 여부를 확인하세요.` }
        : { status, hint: `${who}의 에러율이 ${pct}로 오르고 있어요. 추이를 지켜보세요.` };
    }
    return status === 'bad'
      ? { status, hint: `${who}의 응답 시간(p95 ${target.p95Ms}ms)이 기준(${THRESHOLDS.p95Ms.bad}ms)을 넘었어요. 롤백 여부를 확인하세요.` }
      : { status, hint: `${who}의 응답 시간(p95 ${target.p95Ms}ms)이 느려지고 있어요. 추이를 지켜보세요.` };
  };

  const panels = { requests: { status: 'ok' as Status, hint: null }, errorRate: panel('errorRate'), p95Ms: panel('p95Ms') };
  const order: (keyof typeof panels)[] = ['errorRate', 'p95Ms', 'requests'];
  const top = order.reduce((a, b) => (rank[panels[b].status] > rank[panels[a].status] ? b : a));

  return {
    app,
    generatedAt: new Date(now).toISOString(),
    window: '5m',
    status: worst(panels.requests.status, panels.errorRate.status, panels.p95Ms.status),
    hint: panels[top].hint,
    traffic:
      scenario === 'single'
        ? [{ version: 'v41', color: 'blue', role: 'stable', weight: 100 }]
        : [
            { version: 'v41', color: 'blue', role: 'stable', weight: 90 },
            { version: 'v42', color: 'green', role: 'canary', weight: 10 },
          ],
    versions: summaries,
    panels,
    thresholds: THRESHOLDS,
    series: { stepSeconds: STEP_SECONDS, timestamps, byVersion: Object.fromEntries(versions.map((v) => [v.version, v.series])) },
  };
}

export function mockServers(range: Range): Servers {
  const n = range === '1h' ? 120 : 30;
  const now = Date.now();
  const timestamps = Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * STEP_SECONDS * 1000).toISOString());
  const node = (name: string, role: 'server' | 'worker', cpu: number, mem: number, pods: number, seed: number) => {
    const status: Status = mem >= 90 || cpu >= 90 ? 'bad' : mem >= 75 || cpu >= 75 ? 'warn' : 'ok';
    return {
      name,
      role,
      status,
      hint: status === 'ok' ? null : `메모리 사용률이 ${mem}%예요. 새 파드를 더 올리기 전에 여유를 확인하세요.`,
      cpuPercent: cpu,
      memory: { usedBytes: Math.round((mem / 100) * 4 * GIB), totalBytes: 4 * GIB, percent: mem },
      pods,
      series: {
        stepSeconds: STEP_SECONDS,
        timestamps,
        cpuPercent: timestamps.map((_, i) => round(cpu + 6 * wave(i, seed), 1)),
        memoryPercent: timestamps.map((_, i) => round(mem + 2 * wave(i, seed + 1), 1)),
      },
    };
  };
  return {
    generatedAt: new Date(now).toISOString(),
    servers: [node('k3s-server', 'server', 21, 48, 11, 1), node('k3s-worker-1', 'worker', 64, 76, 9, 2), node('k3s-worker-2', 'worker', 37, 58, 7, 3)],
  };
}

export function mockLogs(app: string, filter: LogFilter, scenario: Scenario): AppLogs {
  const now = Date.now();
  const blue = { version: 'v41', color: 'blue', pod: `${app}-blue-6c9f7d8b5-x2kqp` };
  const green = { version: 'v42', color: 'green', pod: `${app}-green-7d4b9c6f8-m8zrt` };
  const items: LogEntry[] = [];
  for (let i = 0; i < 40; i++) {
    const ts = new Date(now - i * 9_000).toISOString();
    const useGreen = scenario !== 'single' && i < 26 && i % 3 === 0;
    const who = useGreen ? green : blue;
    let level: LogEntry['level'] = 'INFO';
    let message = `GET /api/posts?page=0 200 ${12 + (i % 7) * 3}ms`;
    let exception: string | null = null;
    if (useGreen && scenario === 'bad' && i % 2 === 0) {
      level = 'ERROR';
      message = 'GET /api/posts 500 Internal Server Error';
      exception = 'java.lang.IllegalStateException: chaos: forced error';
    } else if (i % 11 === 5) {
      level = 'WARN';
      message = `GET /chaos/slow?ms=1500 200 ${1500 + i}ms`;
    } else if (i === 26 && scenario !== 'single') {
      message = 'Readiness state changed to ACCEPTING_TRAFFIC';
    }
    items.push({ timestamp: ts, level, version: who.version, color: who.color, pod: who.pod, message, exception, traceId: null });
  }
  const min = filter === 'ERROR' ? ['ERROR'] : filter === 'WARN' ? ['WARN', 'ERROR'] : null;
  return { app, items: min ? items.filter((x) => min.includes(x.level)) : items, nextCursor: null };
}
