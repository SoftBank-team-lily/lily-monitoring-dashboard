'use client';
import { useState } from 'react';
import type { AppLogs, LogFilter, Role } from '@/lib/types';
import { clock } from '@/lib/format';
import s from './dashboard.module.css';

interface Props { data: AppLogs; filter: LogFilter; onFilter: (f: LogFilter) => void; roles: Record<string, Role>; version: string; onVersion: (v: string) => void; }
export function LogTable({ data, filter, onFilter, roles, version, onVersion }: Props) {
  const [search, setSearch] = useState('');
  const versions = Array.from(new Set([...Object.keys(roles), ...data.items.flatMap((e) => e.version ? [e.version] : []), ...(version === 'ALL' ? [] : [version])]));
  const items = data.items.filter((e) =>
    (filter === 'ALL' || e.level === 'ERROR' || filter === 'WARN' && e.level === 'WARN') &&
    (version === 'ALL' || e.version === version) &&
    `${e.message} ${e.exception ?? ''} ${e.pod} ${e.traceId ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );
  return <section className={`${s.card} ${s.logsCard}`} aria-labelledby="logs-title">
    <header className={s.cardHead}><h2 id="logs-title" tabIndex={-1}>최근 로그</h2><span className={s.muted}>최신 수집 {data.items.length}건</span></header>
    <div className={s.logFilters}>
      <label><span className={s.srOnly}>로그 수준</span><select value={filter} onChange={(e) => onFilter(e.target.value as LogFilter)}><option value="ALL">모든 수준</option><option value="WARN">경고 이상</option><option value="ERROR">에러만</option></select></label>
      <label><span className={s.srOnly}>로그 버전</span><select value={version} onChange={(e) => onVersion(e.target.value)}><option value="ALL">모든 버전</option>{versions.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className={s.logSearch}><span className={s.srOnly}>수집된 로그 검색</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="수집된 로그 검색…" /></label>
    </div>
    <div className={s.logSummary} aria-live="polite"><span>{items.length}건 표시</span><span>에러 {items.filter((e) => e.level === 'ERROR').length}건</span></div>
    {!items.length ? <p className={s.empty}>조건에 맞는 로그가 없습니다. 수준·버전·검색어를 확인하세요.</p> : <ol className={s.logList}>
      {items.map((e, i) => <li key={`${e.timestamp}-${i}`} className={s.logItem} data-level={e.level}>
        <details><summary className={s.logRow}>
          <time className={s.logTime} dateTime={e.timestamp}>{clock(e.timestamp)}</time>
          <span className={s.level} data-level={e.level}>{e.level}</span>
          <span className={s.versionChip} data-role={e.version ? roles[e.version] : undefined}>{e.version ?? '—'}</span>
          <span className={s.logMsg}>{e.message}</span><span className={s.logExpand} aria-hidden="true">+</span>
        </summary><div className={s.logDetail}><dl><dt>Pod</dt><dd>{e.pod}</dd><dt>Trace ID</dt><dd>{e.traceId ?? '수집되지 않음'}</dd>{e.exception && <><dt>Exception</dt><dd className={s.exception}>{e.exception}</dd></>}</dl></div></details>
      </li>)}
    </ol>}
    <p className={s.panelFoot}>행을 펼쳐 Pod · Trace ID · 예외 확인</p>
  </section>;
}
