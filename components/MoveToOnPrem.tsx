'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n/provider';
import type { Project } from '@/lib/project';
import s from './dashboard.module.css';

type Database = 'cloud' | 'local';
type Agent = { connected: boolean; agentId: string | null; database: boolean } | null;

/** lily-frontend MovePanel 과 같은 선택지·문구. 서버(/move)가 에이전트·DB 터널·DB 종류를 다시 검사한다 */
const DATABASES: { value: Database; label: string; description: string }[] = [
  { value: 'cloud', label: 'DB 는 클라우드(RDS)에 두기', description: '내 PC 앱이 터널로 지금 쓰던 RDS 를 그대로 써요. 데이터 이동이 없어요.' },
  { value: 'local', label: 'DB 도 내 PC 로 옮기기', description: 'RDS 의 스키마와 데이터를 내 PC DB 로 복사해요. 전환하는 동안(내 PC 빌드 포함) 앱이 잠시 응답하지 않아요.' },
];
const RUNNING = ['queued', 'running'];

/** 클라우드 프로젝트를 내 PC 로 옮긴다. 공개 주소는 그대로이고, 내 PC 배포가 확인된 뒤에만 클라우드를 내린다. */
export function MoveToOnPrem({ project, accountUrl, onExpand }: { project: Project; accountUrl: string; onExpand?: () => void }) {
  const { t } = useI18n();
  const cache = useQueryClient();
  const latest = project.latestDeployment;
  const movingNow = latest?.move === 'onprem' && RUNNING.includes(latest.status);
  const canMove = latest?.status === 'succeeded';
  const hasDatabase = project.database === 'postgres' || project.database === 'mysql';
  const [open, setOpen] = useState(false);
  const [database, setDatabase] = useState<Database>('cloud');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const agent = useQuery<Agent, Error>({
    queryKey: ['agent', project.id],
    enabled: open,
    refetchInterval: open ? 5000 : false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/dashboard/api/projects/${project.id}/control?action=agent`, { cache: 'no-store', signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? '에이전트 상태를 불러오지 못했어요.');
      return body.agent;
    },
  });
  const connected = agent.data?.connected === true;

  async function start() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/dashboard/api/projects/${project.id}/control?action=move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'onprem', database: hasDatabase ? database : null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? '요청을 적용하지 못했어요.');
      cache.setQueryData(['project-control', project.id], result);
      void cache.invalidateQueries({ queryKey: ['project-monitor', project.id] });
      setOpen(false);
      setNotice('전환을 시작했어요. 진행 상황은 배포와 실행 상태에서 확인해 주세요.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '서버에 연결하지 못했어요.');
    } finally { setBusy(false); }
  }

  return <section className={s.trafficPanel}>
    <div className={s.cardHead}><h2>{t("거점과 트래픽")}</h2></div>
    <p className={s.empty}>{t("온프레미스로 배포한 프로젝트에서 거점 전환과 클라우드 버스팅을 관리할 수 있어요.")}</p>
    {movingNow && <p className={s.hint} role="status">{t("클라우드 → 온프레미스 전환 중")}{latest?.stage ? ` · ${latest.stage}` : ''}</p>}
    {canMove && !open && <div className={s.trafficActions}>
      <button type="button" onClick={() => { setOpen(true); setNotice(null); onExpand?.(); }}>{t("클라우드 → 온프레미스 전환")}</button>
    </div>}
    {open && <div className={s.trafficConfirm}>
      <p><strong>{t("클라우드 → 온프레미스 전환")}</strong></p>
      <p>{t("주소는 그대로예요. 내 PC 에 배포가 끝나고 그 주소로 닿는 걸 확인한 뒤에만 클라우드를 내려요. 중간에 실패하면 클라우드가 계속 받아요.")}</p>
      <p role="status">{agent.isError ? t(agent.error.message)
        : connected ? <>{t("내 PC 에이전트 연결됨")}{agent.data?.agentId ? ` · ${agent.data.agentId}` : ''}</>
        : <>{t("내 PC 에이전트가 연결되지 않았어요.")}{" "}<a href={accountUrl}>{t("에이전트 연결하기 ↗")}</a></>}</p>
      {hasDatabase && <fieldset className={s.moveDatabase} disabled={busy}>
        <legend>{t("DB 위치")}</legend>
        {DATABASES.map((option) => {
          const unsupported = option.value === 'local' && project.database !== 'postgres';
          return <label key={option.value}>
            <input type="radio" name={`move-database-${project.id}`} value={option.value} checked={database === option.value}
              disabled={unsupported} onChange={() => setDatabase(option.value)} />
            <span><strong>{t(option.label)}</strong><span className={s.hint}>{unsupported ? t("PostgreSQL 앱만 옮길 수 있어요.") : t(option.description)}</span></span>
          </label>;
        })}
      </fieldset>}
      <div className={s.trafficActions}>
        <button type="button" disabled={busy || !connected || agent.isError || !canMove} onClick={() => void start()}>
          {busy ? t("요청 중…") : connected ? t("전환 시작") : t("에이전트 연결을 기다리는 중")}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>{t("닫기")}</button>
      </div>
    </div>}
    {notice && <p className={s.hint} role="status">{t(notice)}</p>}
    {error && <p className={s.failure} role="alert">{t(error)}</p>}
  </section>;
}
