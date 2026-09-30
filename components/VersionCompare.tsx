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
  const { traffic, versions, thresholds } = data;
  const weightOf = (version: string) => traffic?.find((t) => t.version === version)?.weight;

  return (
    <section id="compare" tabIndex={-1} className={s.card} aria-labelledby="compare-title">
      <header className={s.cardHead}>
        <h2 id="compare-title" tabIndex={-1}>버전 비교</h2>
        <p>최근 {windowLabel(data.window)} 기준</p>
      </header>

      {traffic ? (
        <div className={s.trafficBlock}>
          <div className={s.bar} role="img" aria-label={traffic.map((t) => `${roleLabel(t.role)} ${t.version}에 트래픽 ${t.weight}퍼센트`).join(', ')}>
            {traffic.map((t) => (
              <div key={t.version} className={s.seg} data-role={t.role} style={{ flexGrow: t.weight, display: t.weight > 0 ? undefined : 'none' }} />
            ))}
          </div>
          <ul className={s.legend}>
            {traffic.map((t) => (
              <li key={t.version}>
                <span className={s.swatch} data-role={t.role} aria-hidden="true" />
                {roleLabel(t.role)} {t.version}
                <strong>{t.weight}%</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={s.empty}>트래픽 비율은 CI/CD 배포 정보가 연결되면 표시돼요.</p>
      )}

      <div className={s.tableWrap}>
        <table className={s.compare}>
          <thead>
            <tr>
              <th scope="col">
                <span className={s.srOnly}>지표</span>
              </th>
              {versions.map((v) => (
                <th key={v.version} scope="col" data-role={v.role}>
                  <span className={s.swatch} data-role={v.role} aria-hidden="true" />
                  {roleLabel(v.role)} <strong>{v.version}</strong>
                  <span className={s.colMeta}>
                    {v.color} 슬롯{weightOf(v.version) !== undefined ? `, 트래픽 ${weightOf(v.version)}%` : ''}
                  </span>
                </th>
              ))}
              <th scope="col" className={s.criteriaCol}>
                기준
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                에러율<span className={s.rowCriteria}>기준 {percent(thresholds.errorRate.bad)} 미만</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.errorRate}>
                  {percent(v.errorRate)}
                </Cell>
              ))}
              <td className={s.criteriaCol}>{percent(thresholds.errorRate.bad)} 미만</td>
            </tr>
            <tr>
              <th scope="row">
                응답 속도 (p95)<span className={s.rowCriteria}>기준 {ms(thresholds.p95Ms.bad)} 미만</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.p95Ms}>
                  {ms(v.p95Ms)}
                </Cell>
              ))}
              <td className={s.criteriaCol}>{ms(thresholds.p95Ms.bad)} 미만</td>
            </tr>
            <tr>
              <th scope="row">
                요청 수<span className={s.rowCriteria}>최소 {thresholds.minRequests}건</span>
              </th>
              {versions.map((v) => (
                <Cell key={v.version} status={v.statuses.requests}>
                  {count(v.requests)}건
                </Cell>
              ))}
              <td className={s.criteriaCol}>{thresholds.minRequests}건 이상</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
