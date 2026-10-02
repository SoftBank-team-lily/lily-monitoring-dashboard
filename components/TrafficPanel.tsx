'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@/lib/project';
import s from './dashboard.module.css';

const homeName: Record<string, string> = {
  ONPREM: 'HOME', CLOUD: 'AWS', MOVING_TO_CLOUD: 'AWS로 전환 중',
  MOVING_TO_ONPREM: 'HOME으로 전환 중', UNKNOWN: '확인 중',
};

async function readProject(id: string, signal?: AbortSignal): Promise<Project> {
  const response = await fetch(`/dashboard/api/projects/${id}/control`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('거점 상태를 불러오지 못했어요.');
  return response.json();
}

function Place({ name, status, detail }: { name: 'HOME' | 'AWS'; status: string; detail: string }) {
  return <div className={s.trafficPlace}>
    <div className={s.trafficPlaceHead}><strong>{name}</strong><span>{status}</span></div>
    <p className={s.hint}>{detail}</p>
    <dl className={s.trafficMetrics}>
      <div><dt>CPU</dt><dd>미수집</dd></div>
      <div><dt>RAM</dt><dd>미수집</dd></div>
      <div><dt>p95</dt><dd>미수집</dd></div>
    </dl>
  </div>;
}

export function TrafficPanel({ project }: { project: Project }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['project-control', project.id],
    queryFn: ({ signal }) => readProject(project.id, signal),
    initialData: project,
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  });
  const current = query.data;
  const burst = current?.burst;
  const live = burst?.live;
  const [mode, setMode] = useState<'auto' | 'manual' | 'off'>(burst?.enabled && burst.cloudPercent ? 'manual' : 'auto');
  const [percent, setPercent] = useState(burst?.cloudPercent || 30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState<'cloud' | 'onprem' | null>(null);
  const [migrateDatabase, setMigrateDatabase] = useState(false);

  useEffect(() => {
    if (!burst || busy) return;
    setMode(burst.enabled ? burst.cloudPercent ? 'manual' : 'auto' : 'auto');
    if (burst.cloudPercent) setPercent(burst.cloudPercent);
  }, [burst?.enabled, burst?.cloudPercent, busy]);

  async function send(action: 'burst' | 'home' | 'cancel' | 'stop', body?: object) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/dashboard/api/projects/${project.id}/control${action === 'cancel' || action === 'stop' ? `?action=${action}` : ''}`, {
        method: action === 'burst' ? 'PUT' : 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? '요청을 적용하지 못했어요.');
      cache.setQueryData(['project-control', project.id], result);
      setTarget(null);
      setNotice(action === 'home' ? '전환을 시작했어요. 현재 단계를 확인해 주세요.' : action === 'burst' ? '설정을 저장했어요. 실제 적용 상태를 확인해 주세요.' : '요청이 처리됐어요.');
      void query.refetch();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '서버에 연결하지 못했어요.');
    } finally { setBusy(false); }
  }

  if (project.target !== 'onprem') return <section className={s.trafficPanel}>
    <div className={s.cardHead}><h2>거점과 트래픽</h2></div>
    <p className={s.empty}>온프레미스로 배포한 프로젝트에서 거점 전환과 클라우드 버스팅을 관리할 수 있어요.</p>
  </section>;

  const moving = live?.home.startsWith('MOVING') ?? false;
  const controlReady = Boolean(burst && burst.agent === 'connected' && live?.available !== false);
  const burstReady = controlReady && !moving && live?.home === 'ONPREM';
  const homeReady = controlReady && live?.movable && !moving && live?.phase !== 'STANDBY';
  const needsDatabaseChoice = Boolean(target && live?.databaseMovable &&
    (target === 'cloud' ? live.databaseMode === 'local' : live.databaseMode === 'cloud'));
  const cloud = current?.cloudPods;
  const same = burst && (mode === 'off' ? !burst.enabled : burst.enabled && burst.cloudPercent === (mode === 'auto' ? 0 : percent));

  return <section className={s.trafficPanel} aria-label="거점과 트래픽">
    <div className={s.cardHead}><h2>거점과 트래픽</h2><span className={s.muted}>15초마다 상태 갱신</span></div>
    <div className={s.trafficPlaces}>
      <Place name="HOME" status={burst?.agent === 'connected' ? '에이전트 연결됨' : '연결 상태 확인 필요'}
        detail={live?.home === 'ONPREM' ? '현재 공개 주소 거점' : live?.home.startsWith('MOVING') ? '거점 전환 중' : '대기 또는 확인 중'} />
      <Place name="AWS" status={cloud ? `${cloud.ready}/${cloud.replicas} Pod 준비` : '클라우드 상태 미수집'}
        detail={live?.home === 'CLOUD' ? '현재 공개 주소 거점' : live?.warm ? '버스팅 대기 준비됨' : '대기 배포 확인 중'} />
    </div>
    <p className={s.trafficFootnote}>HOME/AWS별 CPU·RAM·p95 관측 API가 연결되면 각 값을 표시합니다. 앱 전체 지표를 한쪽 값으로 대체하지 않습니다.</p>
    <div className={s.trafficSection}>
      <div className={s.trafficRow}><strong>공개 주소 거점</strong><span>{homeName[live?.home ?? 'UNKNOWN']}</span></div>
      {moving && <p className={s.hint}>진행 단계: {live?.homeStep || '상태 확인 중'} {live?.homeCancellable && <button type="button" disabled={busy} onClick={() => void send('cancel')}>전환 취소</button>}</p>}
      <div className={s.trafficActions}>
        <button type="button" disabled={!homeReady || busy || live?.home === 'ONPREM'} onClick={() => { setTarget('onprem'); setMigrateDatabase(false); }}>HOME으로 전환</button>
        <button type="button" disabled={!homeReady || busy || live?.home === 'CLOUD'} onClick={() => { setTarget('cloud'); setMigrateDatabase(false); }}>AWS로 전환</button>
      </div>
      {cloud && cloud.replicas > 0 && live?.home === 'ONPREM' && !burst?.enabled && <div className={s.trafficActions}><button type="button" disabled={busy} onClick={() => void send('stop')}>쓰지 않는 AWS Pod 내리기</button></div>}
      {target && <div className={s.trafficConfirm}>
        <p>공개 주소를 {target === 'cloud' ? 'AWS' : 'HOME'}로 전환합니다. 완료 전까지 현재 거점을 유지합니다.</p>
        {needsDatabaseChoice && <p>{migrateDatabase ? '앱 DB도 새 거점으로 복사합니다. 전환 중 잠시 응답이 멈출 수 있어요.' : `DB는 기존 ${live?.databaseMode === 'local' ? 'HOME' : 'AWS'}에 남습니다. 기존 거점이 꺼지면 앱이 DB에 연결하지 못할 수 있어요.`}</p>}
        {needsDatabaseChoice && <label><input type="checkbox" checked={migrateDatabase} onChange={(event) => setMigrateDatabase(event.target.checked)} /> DB도 함께 옮기기</label>}
        <div className={s.trafficActions}><button type="button" disabled={busy} onClick={() => void send('home', { home: target, migrateDatabase })}>전환 시작</button><button type="button" disabled={busy} onClick={() => setTarget(null)}>닫기</button></div>
      </div>}
    </div>
    <div className={s.trafficSection}>
      <div className={s.trafficRow}><strong>Traffic · 클라우드 버스팅</strong><span>{live?.enabled ? live.cloudPercent ? `HOME ${100 - live.cloudPercent}% / AWS ${live.cloudPercent}%` : '자동' : burst?.enabled ? '적용 대기' : '꺼짐'}</span></div>
      <p className={s.hint}>자동은 평소 HOME에서 처리하고, 과부하 때 AWS로 넘깁니다. 수동은 정한 비율로 분산합니다.</p>
      <div className={s.trafficModes} role="group" aria-label="트래픽 모드">
        <button type="button" aria-pressed={mode === 'auto'} disabled={!burstReady || busy} onClick={() => setMode('auto')}>자동</button>
        <button type="button" aria-pressed={mode === 'manual'} disabled={!burstReady || busy} onClick={() => setMode('manual')}>수동</button>
        <button type="button" aria-pressed={mode === 'off'} disabled={!burstReady || busy} onClick={() => setMode('off')}>끄기</button>
      </div>
      {mode === 'manual' && <div className={s.trafficSlider}>
        <label htmlFor={`traffic-${project.id}`}>HOME {100 - percent}% <span>AWS {percent}%</span></label>
        <input id={`traffic-${project.id}`} type="range" min="5" max="100" step="5" value={percent}
          disabled={!burstReady || busy} onChange={(event) => setPercent(Number(event.target.value))} />
      </div>}
      <div className={s.trafficActions}><button type="button" disabled={!burstReady || busy || Boolean(same)} onClick={() => void send('burst', { enabled: mode !== 'off', cloudPercent: mode === 'auto' ? 0 : mode === 'manual' ? percent : burst?.cloudPercent ?? 0 })}>{busy ? '적용 중…' : '트래픽 설정 적용'}</button></div>
      {live?.enabled && <p className={s.hint}>처리 중 요청 · HOME {live.localActive} / AWS {live.remoteActive} · AWS로 보낸 요청 누적 {live.overflowedTotal}건</p>}
    </div>
    {!controlReady && <p className={s.hint}>{query.isError ? query.error.message : burst?.agent === 'offline' ? 'HOME 에이전트가 연결되지 않았어요.' : burst?.agent === 'outdated' ? 'HOME 에이전트를 업데이트해야 해요.' : '에이전트와 배포 상태를 확인한 뒤 조절할 수 있어요.'}</p>}
    {error && <p className={s.failure} role="alert">{error}</p>}
    {notice && <p className={s.hint} role="status">{notice}</p>}
  </section>;
}
