"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Servers } from '@/lib/types';
import { gigabytes, plainPercent } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import s from './dashboard.module.css';

function Gauge({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const { t } = useI18n();
  // Status is supplied by the server; gauges show quantity without a second severity policy.
  return (
    <div className={s.gauge}>
      <div className={s.gaugeHead}>
        <span>{t(label)}</span>
        <strong>{plainPercent(value)}</strong>
      </div>
      <div className={s.gaugeTrack} role="meter" aria-label={t("{{value0}} 사용률", { value0: t(label) })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <div className={s.gaugeFill} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {detail && <span className={s.gaugeDetail}>{t(detail)}</span>}
    </div>
  );
}

export function ServerList({ data }: { data: Servers }) {
  const { t } = useI18n();
  return (
    <section className={s.card} aria-labelledby="servers-title">
      <header className={s.cardHead}>
        <h2 id="servers-title" tabIndex={-1}>{t("서버 자원")}</h2>
        <p>{t("k3s 노드")}{" "}{data.servers.length}{t("대")}</p>
      </header>
      {data.servers.length === 0 && <p className={s.empty}>{t("수집된 서버가 없습니다.")}</p>}
      <ul className={s.serverList}>
        {data.servers.map((sv) => (
          <li key={sv.name} className={s.server} data-status={sv.status}>
            <div className={s.serverHead}>
              <div>
                <strong>{sv.name}</strong>
                <span>
                  {sv.role === 'server' ? t("관리 노드") : t("작업 노드")}{t(", 파드")}{" "}{sv.pods}{t("개")}</span>
              </div>
              <StatusBadge status={sv.status} />
            </div>
            <div className={s.gauges}>
              <Gauge label="CPU" value={sv.cpuPercent} />
              <Gauge label={t("메모리")} value={sv.memory.percent} detail={`${gigabytes(sv.memory.usedBytes)} / ${gigabytes(sv.memory.totalBytes)}`} />
            </div>
            {sv.hint && (
              <p className={s.hint} data-status={sv.status}>
                {t(sv.hint)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
