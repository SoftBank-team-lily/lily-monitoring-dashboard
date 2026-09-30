import type { AppMetrics, Servers, Status } from '@/lib/types';
import { count, ms, percent, plainPercent } from '@/lib/format';
import { busiestServer, worstVersion } from '@/lib/monitoring';
import { statusLabel } from './StatusBadge';
import s from './dashboard.module.css';

function Tile({ label, status, value, caption, detail }: { label: string; status: Status; value: string; caption: string; detail: string }) {
  return <article className={s.tile} data-status={status}>
    <header className={s.tileHead}><h3>{label}</h3><span className={s.statusDot} data-status={status} role="img" aria-label={statusLabel(status)} title={statusLabel(status)} /></header>
    <p className={s.tileValue}>{value}</p><p className={s.tileCaption}>{caption}</p><p className={s.tileCompare}>{detail}</p>
  </article>;
}

export function HealthTiles({ metrics, servers }: { metrics: AppMetrics; servers?: Servers }) {
  const er = worstVersion(metrics.versions, 'errorRate');
  const lat = worstVersion(metrics.versions, 'p95Ms');
  const server = busiestServer(servers);
  const total = metrics.versions.reduce((sum, v) => sum + v.requests, 0);
  const baseline = metrics.versions.find((v) => v.role === 'stable');
  const isCpu = server && server.cpuPercent > server.memory.percent;
  return <div className={s.tiles}>
    <Tile label="에러율" status={metrics.panels.errorRate.status} value={percent(er?.errorRate)} caption={er ? `${er.version} · 기준 ${percent(metrics.thresholds.errorRate.bad)} 미만` : '수집된 버전 없음'} detail={baseline && baseline !== er ? `${baseline.version} ${percent(baseline.errorRate)} · 기존 버전` : '요청 중 오류 비율'} />
    <Tile label="응답 시간 · p95" status={metrics.panels.p95Ms.status} value={ms(lat?.p95Ms)} caption={lat ? `${lat.version} · 기준 ${ms(metrics.thresholds.p95Ms.bad)} 미만` : '수집된 버전 없음'} detail={baseline && baseline !== lat ? `${baseline.version} ${ms(baseline.p95Ms)} · 기존 버전` : '요청의 95%가 이 시간 이내 응답'} />
    <Tile label="요청 수" status={metrics.panels.requests.status} value={count(total)} caption="모든 버전 합계 · 건" detail={`판단 최소 표본 ${metrics.thresholds.minRequests}건 / 버전`} />
    <Tile label={`서버 ${isCpu ? 'CPU' : '메모리'}`} status={server?.status ?? 'unknown'} value={server ? plainPercent(Math.max(server.cpuPercent, server.memory.percent)) : '—'} caption={server?.name ?? '서버 지표 없음'} detail={server ? `노드 ${servers!.servers.length}대 중 자원 확인 우선` : '서버 패널에서 수집 상태 확인'} />
  </div>;
}
