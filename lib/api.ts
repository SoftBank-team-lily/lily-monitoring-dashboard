import type { AppLogs, AppMetrics, LogFilter, Range, Servers } from './types';
import { mockAppMetrics, mockLogs, mockServers, type Scenario } from './mock';

/**
 * API 호출 계층. NEXT_PUBLIC_API_BASE_URL이 없거나 NEXT_PUBLIC_USE_MOCK=1이면 예시 데이터를 쓴다.
 * 실제 API가 준비되면 환경 변수만 바꾸면 되고, 컴포넌트는 그대로다.
 */
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === '1' || !BASE;

export function scenario(): Scenario {
  if (typeof window === 'undefined') return 'bad';
  const s = new URLSearchParams(window.location.search).get('scenario');
  return s === 'healthy' || s === 'single' ? s : 'bad';
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} 요청이 ${res.status}로 실패했어요`);
  return (await res.json()) as T;
}

const delay = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), 250));

export const api = {
  appMetrics(app: string, range: Range): Promise<AppMetrics> {
    return USE_MOCK ? delay(mockAppMetrics(app, range, scenario())) : get(`/api/apps/${encodeURIComponent(app)}/metrics?range=${range}`);
  },
  appLogs(app: string, filter: LogFilter, limit = 50): Promise<AppLogs> {
    const level = filter === 'ALL' ? '' : `&level=${filter}`;
    return USE_MOCK ? delay(mockLogs(app, filter, scenario())) : get(`/api/apps/${encodeURIComponent(app)}/logs?limit=${limit}${level}`);
  },
  servers(range: Range): Promise<Servers> {
    return USE_MOCK ? delay(mockServers(range)) : get(`/api/servers?range=${range}`);
  },
};
