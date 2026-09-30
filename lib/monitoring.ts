import type { AppMetrics, Servers, Status, VersionSummary } from './types';

const rank: Record<Status, number> = { unknown: 0, ok: 1, warn: 2, bad: 3 };

export function worstVersion(versions: VersionSummary[], key: 'errorRate' | 'p95Ms') {
  return versions.reduce<VersionSummary | undefined>((a, b) => {
    if (!a) return b;
    const difference = rank[b.statuses[key]] - rank[a.statuses[key]];
    return difference > 0 || (difference === 0 && b.role === 'canary') ? b : a;
  }, undefined);
}

export function busiestServer(data?: Servers) {
  return data?.servers.reduce<Servers['servers'][number] | undefined>((a, b) => {
    if (!a) return b;
    const difference = rank[b.status] - rank[a.status];
    return difference > 0 || (difference === 0 && Math.max(b.cpuPercent, b.memory.percent) > Math.max(a.cpuPercent, a.memory.percent)) ? b : a;
  }, undefined);
}

/**
 * Investigation entry point. The backend owns severity; this only chooses navigation.
 * TODO(product): tune these 5 lines if the team's first response should be version comparison.
 * Default: an application error opens logs; infrastructure issues open the server panel.
 */
export function investigationTarget(metrics: AppMetrics, servers?: Servers): 'logs' | 'servers' | 'compare' {
  if (metrics.status === 'bad') return 'logs';
  if (servers?.servers.some((server) => server.status === 'bad' || server.status === 'warn')) return 'servers';
  if (metrics.status === 'warn') return 'logs';
  return 'compare';
}
