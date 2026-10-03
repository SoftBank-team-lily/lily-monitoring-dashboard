"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { AppMetrics, Servers, Status } from '@/lib/types';
import { count, ms, percent, plainPercent } from '@/lib/format';
import { busiestServer, worstVersion } from '@/lib/monitoring';
import { statusLabel } from './StatusBadge';
import s from './dashboard.module.css';

function Tile({ label, status, value, caption, detail }: { label: string; status: Status; value: string; caption: string; detail: string }) {
  const { t } = useI18n();
  return <article className={s.tile} data-status={status}>
    <header className={s.tileHead}><h3>{t(label)}</h3><span className={s.statusDot} data-status={status} role="img" aria-label={t(statusLabel(status))} title={t(statusLabel(status))} /></header>
    <p className={s.tileValue}>{t(value)}</p><p className={s.tileCaption}>{caption}</p><p className={s.tileCompare}>{t(detail)}</p>
  </article>;
}

export function HealthTiles({ metrics, servers }: { metrics: AppMetrics; servers?: Servers }) {
  const { t } = useI18n();
  const er = worstVersion(metrics.versions, 'errorRate');
  const lat = worstVersion(metrics.versions, 'p95Ms');
  const server = busiestServer(servers);
  const total = metrics.versions.reduce((sum, v) => sum + v.requests, 0);
  const baseline = metrics.versions.find((v) => v.role === 'stable');
  const isCpu = server && server.cpuPercent > server.memory.percent;
  return <div className={s.tiles}>
    <Tile label={t("에러율")} status={metrics.panels.errorRate.status} value={percent(er?.errorRate)} caption={er ? t("{{value0}} · 기준 {{value1}} 미만", { value0: er.version, value1: percent(metrics.thresholds.errorRate.bad) }) : t("수집된 버전 없음")} detail={baseline && baseline !== er ? t("{{value0}} {{value1}} · 기존 버전", { value0: baseline.version, value1: percent(baseline.errorRate) }) : t("요청 중 오류 비율")} />
    <Tile label={t("응답 시간 · p95")} status={metrics.panels.p95Ms.status} value={ms(lat?.p95Ms)} caption={lat ? t("{{value0}} · 기준 {{value1}} 미만", { value0: lat.version, value1: ms(metrics.thresholds.p95Ms.bad) }) : t("수집된 버전 없음")} detail={baseline && baseline !== lat ? t("{{value0}} {{value1}} · 기존 버전", { value0: baseline.version, value1: ms(baseline.p95Ms) }) : t("요청의 95%가 이 시간 이내 응답")} />
    <Tile label={t("요청 수")} status={metrics.panels.requests.status} value={count(total)} caption={t("모든 버전 합계 · 건")} detail={t("판단 최소 표본 {{value0}}건 / 버전", { value0: metrics.thresholds.minRequests })} />
    <Tile label={t("서버 {{value0}}", { value0: isCpu ? 'CPU' : t("메모리") })} status={server?.status ?? 'unknown'} value={server ? plainPercent(Math.max(server.cpuPercent, server.memory.percent)) : '—'} caption={server?.name ?? t("서버 지표 없음")} detail={server ? t("노드 {{value0}}대 중 자원 확인 우선", { value0: servers!.servers.length }) : t("서버 패널에서 수집 상태 확인")} />
  </div>;
}
