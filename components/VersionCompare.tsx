"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { AppMetrics, Status } from '@/lib/types';
import { count, ms, percent, windowLabel } from '@/lib/format';
import { StatusIcon, roleLabel } from './StatusBadge';
import s from './dashboard.module.css';

function Cell({ status, children }: { status: Status; children: React.ReactNode }) {
  const flagged = status === 'warn' || status === 'bad';
  return (
    <td className={s.cmpCell} data-status={status}>
      <span>{children}</span>
      {flagged && <StatusIcon status={status} size={16} />}
    </td>
  );
}

/** 기존 버전과 새 버전을 나란히: 트래픽은 얼마씩, 어느 쪽이 나쁜지 */
export function VersionCompare({ data }: { data: AppMetrics }) {
  const { t } = useI18n();
  const { traffic, versions, thresholds } = data;
  const weightOf = (version: string) => traffic?.find((entry) => entry.version === version)?.weight;

  return (
    <section id="compare" tabIndex={-1} className={s.card} aria-labelledby="compare-title">
      <header className={s.cardHead}>
        <h2 id="compare-title" tabIndex={-1}>{t("버전 비교")}</h2>
        <p>{t("최근")}{" "}{t(windowLabel(data.window))} {" "}{t("기준")}</p>
      </header>

      {traffic ? (
        <div className={s.trafficBlock}>
          <div className={s.bar} role="img" aria-label={traffic.map((entry) => t("{{value0}} {{value1}}에 트래픽 {{value2}}퍼센트", { value0: t(roleLabel(entry.role)), value1: entry.version, value2: entry.weight })).join(', ')}>
            {traffic.map((entry) => (
              <div key={entry.version} className={s.seg} data-role={entry.role} style={{ flexGrow: entry.weight, display: entry.weight > 0 ? undefined : 'none' }} />
            ))}
          </div>
          <ul className={s.legend}>
            {traffic.map((entry) => (
              <li key={entry.version}>
                <span className={s.swatch} data-role={entry.role} aria-hidden="true" />
                {t(roleLabel(entry.role))} {entry.version}
                <strong>{entry.weight}%</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={s.empty}>{t("트래픽 비율은 CI/CD 배포 정보가 연결되면 표시돼요.")}</p>
      )}

      <div className={s.tableWrap}>
        <table className={s.compare}>
          <thead>
            <tr>
              <th scope="col">
                <span className={s.srOnly}>{t("지표")}</span>
              </th>
              {versions.map((v) => (
                <th key={v.version} scope="col" data-role={v.role}>
                  <span className={s.swatch} data-role={v.role} aria-hidden="true" />
                  {t(roleLabel(v.role))} <strong>{v.version}</strong>
                  <span className={s.colMeta}>
                    {v.color} {" "}{t("슬롯")}{weightOf(v.version) !== undefined ? t(", 트래픽 {{value0}}%", { value0: weightOf(v.version) }) : ''}
                  </span>
                </th>
              ))}
              <th scope="col" className={s.criteriaCol}>
                {t("기준")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                {t("에러율")}<span className={s.rowCriteria}>{t("기준")}{" "}{percent(thresholds.errorRate.bad)} {" "}{t("미만")}</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.errorRate}>
                  {percent(v.errorRate)}
                </Cell>
              ))}
              <td className={s.criteriaCol}>{percent(thresholds.errorRate.bad)} {" "}{t("미만")}</td>
            </tr>
            <tr>
              <th scope="row">
                {t("응답 속도 (p95)")}<span className={s.rowCriteria}>{t("기준")}{" "}{ms(thresholds.p95Ms.bad)} {" "}{t("미만")}</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.p95Ms}>
                  {ms(v.p95Ms)}
                </Cell>
              ))}
              <td className={s.criteriaCol}>{ms(thresholds.p95Ms.bad)} {" "}{t("미만")}</td>
            </tr>
            <tr>
              <th scope="row">
                {t("요청 수")}<span className={s.rowCriteria}>{t("최소")}{" "}{thresholds.minRequests}{t("건")}</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.requests}>
                  {count(v.requests)}{t("건")}</Cell>
              ))}
              <td className={s.criteriaCol}>{thresholds.minRequests}{t("건 이상")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
