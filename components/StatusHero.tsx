"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { AppMetrics, Servers } from '@/lib/types';
import { busiestServer, investigationTarget } from '@/lib/monitoring';
import { StatusIcon } from './StatusBadge';
import s from './dashboard.module.css';

export function StatusHero({ data, servers, onInvestigate }: { data: AppMetrics; servers?: Servers; onInvestigate: (target: 'logs' | 'servers' | 'compare') => void }) {
  const { t } = useI18n();
  const server = busiestServer(servers);
  const serverFirst = server && (server.status === 'bad' && data.status !== 'bad' || server.status === 'warn' && (data.status === 'ok' || data.status === 'unknown'));
  const status = serverFirst ? server.status : data.status;
  const affected = data.versions.find((v) => v.statuses.errorRate === status || v.statuses.p95Ms === status);
  const title = serverFirst ? t("{{value0}} · 자원 확인 필요", { value0: server.name }) : {
    bad: t("{{value0}} · 성능 기준 초과", { value0: affected?.version ?? '앱' }), warn: t("{{value0}} · 성능 확인 필요", { value0: affected?.version ?? '앱' }), ok: t("애플리케이션 지표 정상"), unknown: t("판단에 필요한 데이터 수집 중"),
  }[status];
  const detail = serverFirst ? server.hint : data.hint ?? (status === 'ok' ? t("에러율과 응답 시간이 설정된 기준 이내입니다.") : t("버전별 최소 {{value0}}건의 요청이 필요합니다.", { value0: data.thresholds.minRequests }));
  const target = investigationTarget(data, servers);
  return (
    <section className={s.hero} data-status={status} aria-label={t("현재 상태")} aria-live="polite">
      <StatusIcon status={status} size={19} />
      <div className={s.heroText}><h2>{t(title)}</h2><p>{t(detail)}</p></div>
      <button className={s.heroAction} type="button" onClick={() => onInvestigate(target)}>{target === 'logs' ? t("문제 로그 확인") : target === 'servers' ? t("서버 확인") : t("버전 비교")}<span aria-hidden="true">↗</span></button>
    </section>
  );
}
