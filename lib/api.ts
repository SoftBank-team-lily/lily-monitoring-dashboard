import type { AppLogs, AppMetrics, LogFilter, Range, Servers } from './types';
import { mockAppMetrics, mockLogs, mockServers, type Scenario } from './mock';

/** /dashboard/demo에서만 사용하는 시연 데이터. 실제 프로젝트는 소유권 API를 사용한다. */
export const USE_MOCK = true;
export function scenario(): Scenario {
  if (typeof window === 'undefined') return 'bad';
  const value = new URLSearchParams(window.location.search).get('scenario');
  return value === 'healthy' || value === 'single' ? value : 'bad';
}
export const api = {
  async appMetrics(app: string, range: Range): Promise<AppMetrics> { return mockAppMetrics(app, range, scenario()); },
  async appLogs(app: string, filter: LogFilter): Promise<AppLogs> { return mockLogs(app, filter, scenario()); },
  async servers(range: Range): Promise<Servers> { return mockServers(range); },
};
