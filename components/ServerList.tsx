import type { Servers } from '@/lib/types';
import { gigabytes, plainPercent } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import s from './dashboard.module.css';

function Gauge({ label, value, detail }: { label: string; value: number; detail?: string }) {
  // Status is supplied by the server; gauges show quantity without a second severity policy.
  return (
    <div className={s.gauge}>
      <div className={s.gaugeHead}>
        <span>{label}</span>
        <strong>{plainPercent(value)}</strong>
      </div>
      <div className={s.gaugeTrack} role="meter" aria-label={`${label} 사용률`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <div className={s.gaugeFill} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {detail && <span className={s.gaugeDetail}>{detail}</span>}
    </div>
  );
}

export function ServerList({ data }: { data: Servers }) {
  return (
    <section className={s.card} aria-labelledby="servers-title">
      <header className={s.cardHead}>
        <h2 id="servers-title" tabIndex={-1}>서버 자원</h2>
        <p>k3s 노드 {data.servers.length}대</p>
      </header>
      {data.servers.length === 0 && <p className={s.empty}>수집된 서버가 없습니다.</p>}
      <ul className={s.serverList}>
        {data.servers.map((sv) => (
          <li key={sv.name} className={s.server} data-status={sv.status}>
            <div className={s.serverHead}>
              <div>
                <strong>{sv.name}</strong>
                <span>
                  {sv.role === 'server' ? '관리 노드' : '작업 노드'}, 파드 {sv.pods}개
                </span>
              </div>
              <StatusBadge status={sv.status} />
            </div>
            <div className={s.gauges}>
              <Gauge label="CPU" value={sv.cpuPercent} />
              <Gauge label="메모리" value={sv.memory.percent} detail={`${gigabytes(sv.memory.usedBytes)} / ${gigabytes(sv.memory.totalBytes)}`} />
            </div>
            {sv.hint && (
              <p className={s.hint} data-status={sv.status}>
                {sv.hint}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
