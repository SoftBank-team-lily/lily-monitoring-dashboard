'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { OBSERVATION_POINTS, type PanelId } from '@/lib/flower-particles';
import type { LogFilter, Range, Role } from '@/lib/types';
import { api, USE_MOCK } from '@/lib/api';
import { windowLabel } from '@/lib/format';
import { TopBar } from './TopBar';
import { StatusHero } from './StatusHero';
import { HealthTiles } from './HealthTiles';
import { VersionCompare } from './VersionCompare';
import { TrendCharts } from './TrendCharts';
import { ServerList } from './ServerList';
import { LogTable } from './LogTable';
import s from './dashboard.module.css';

const ParticleStage = dynamic(() => import('./ParticleStage'), { ssr: false });

function Failure({ what, retry }: { what: string; retry: () => void }) {
  return <div className={s.failure} role="alert"><span>{what}를 불러오지 못했습니다.</span><button className={s.textButton} onClick={retry}>다시 시도 ↗</button></div>;
}
function Loading({ what }: { what: string }) { return <p className={s.loading} role="status">{what} 수집 중…</p>; }

export function Dashboard({ apps }: { apps: string[] }) {
  const [view, setView] = useState<'spatial' | 'list'>('spatial');
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [wide, setWide] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [app, setApp] = useState(apps[0] ?? 'lily-blog-sample');
  const [range, setRange] = useState<Range>('15m');
  const [filter, setFilter] = useState<LogFilter>('ALL');
  const [logVersion, setLogVersion] = useState('ALL');
  const metrics = useQuery({ queryKey: ['metrics', app, range], queryFn: () => api.appMetrics(app, range), refetchInterval: 15_000 });
  const servers = useQuery({ queryKey: ['servers', range], queryFn: () => api.servers(range), refetchInterval: 15_000 });
  const logs = useQuery({
    queryKey: ['logs', app, filter], queryFn: () => api.appLogs(app, filter), refetchInterval: 10_000,
    placeholderData: (previous, query) => query?.queryKey[1] === app ? previous : undefined,
  });
  const roles: Record<string, Role> = Object.fromEntries((metrics.data?.versions ?? []).map((v) => [v.version, v.role]));
  const refresh = () => { void metrics.refetch(); void servers.refetch(); void logs.refetch(); };
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setWide(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function reset() {
    setActivePanel(null);
    requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); });
  }
  useEffect(() => {
    if (!activePanel) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A native search input may use Escape to clear text; it can handle that first.
      if (e.defaultPrevented) return;
      setActivePanel(null);
      requestAnimationFrame(() => returnFocus.current?.isConnected && returnFocus.current.focus({ preventScroll: true }));
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [activePanel]);
  function select(panel: PanelId) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActivePanel(panel);
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-panel="${panel}"]`);
      element?.focus({ preventScroll: true });
      if (!wide || view === 'list') element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function investigate(target: 'logs' | 'servers' | 'compare') {
    if (target === 'logs') {
      const affected = metrics.data?.versions.find((v) => v.statuses.errorRate === 'bad');
      setFilter(affected ? 'ERROR' : 'WARN'); setLogVersion(affected?.version ?? 'ALL');
    }
    select(target);
  }
  const panels: Record<PanelId, React.ReactNode> = {
    metrics: metrics.isError ? <Failure what="앱 지표" retry={() => void metrics.refetch()} /> : metrics.data ? <section id="metrics" aria-labelledby="metrics-title"><div className={s.sectionHead}><h2 id="metrics-title">앱 지표</h2><span>최근 {windowLabel(metrics.data.window)} 요약</span></div><HealthTiles metrics={metrics.data} servers={servers.isError ? undefined : servers.data} /></section> : <Loading what="앱 지표" />,
    trends: metrics.isError ? <Failure what="지표 추이" retry={() => void metrics.refetch()} /> : metrics.data ? <TrendCharts data={metrics.data} range={range} /> : <Loading what="지표 추이" />,
    compare: metrics.isError ? <Failure what="버전 비교" retry={() => void metrics.refetch()} /> : metrics.data ? <VersionCompare data={metrics.data} /> : <Loading what="버전 비교" />,
    servers: <div id="servers">{servers.isError ? <Failure what="서버 지표" retry={() => void servers.refetch()} /> : servers.data ? <ServerList data={servers.data} /> : <Loading what="서버 지표" />}</div>,
    logs: <div id="logs">{logs.isError ? <Failure what="로그" retry={() => void logs.refetch()} /> : logs.data ? <LogTable key={app} data={logs.data} filter={filter} onFilter={setFilter} roles={roles} version={logVersion} onVersion={setLogVersion} /> : <Loading what="로그" />}</div>,
  };
  const focusedScene = view === 'spatial' && wide && activePanel !== null;
  const order: PanelId[] = view === 'spatial' ? ['metrics', 'compare', 'servers', 'logs', 'trends'] : ['metrics', 'trends', 'compare', 'servers', 'logs'];

  return <div className={`${s.page} ${view === 'spatial' ? s.spatial : ''}`}>
    <TopBar apps={apps} app={app} onApp={(value) => { setApp(value); setActivePanel(null); setLogVersion('ALL'); setFilter('ALL'); }} range={range} onRange={setRange} updatedAt={metrics.data ? Date.parse(metrics.data.generatedAt) : undefined} mock={USE_MOCK} refreshing={metrics.isFetching || servers.isFetching || logs.isFetching} onRefresh={refresh} />
    <main className={s.main} id="overview" tabIndex={-1}>
      <div className={s.pageHeading}><div><p className={s.eyebrow}>OBSERVABILITY</p><h1>서비스 모니터링</h1><p className={s.subtitle}>배포 이후의 상태를 한눈에.</p></div><div className={s.viewControls}><span className={s.polling}>지표 15초 · 로그 10초 갱신</span><div className={s.segmented} role="group" aria-label="대시보드 보기"><button type="button" aria-pressed={view === 'spatial'} onClick={() => { setView('spatial'); setActivePanel(null); }}>공간 보기</button><button type="button" aria-pressed={view === 'list'} onClick={() => { setView('list'); setActivePanel(null); }}>목록 보기</button></div></div></div>
      <nav className={s.sectionNav} aria-label="패널 바로가기"><a href="#metrics">앱 지표</a><a href="#compare">버전 비교</a><a href="#servers">서버</a><a href="#logs">로그</a></nav>
      {metrics.data && !metrics.isError && <StatusHero data={metrics.data} servers={servers.isError ? undefined : servers.data} onInvestigate={investigate} />}
      <div className={s.layout} data-focus={activePanel ?? undefined} data-expanded={focusedScene || undefined}>
        {view === 'spatial' && wide ? <ParticleStage app={app} active={activePanel} panels={panels} onSelect={select} onReset={reset} /> : order.map((id) => {
          const point = OBSERVATION_POINTS.find((p) => p.id === id)!;
          const hidden = focusedScene && activePanel !== id;
          return <div key={id} className={s.scenePanel} data-panel={id} data-selected={activePanel === id || undefined} tabIndex={-1} inert={hidden} aria-hidden={hidden || undefined} aria-label={`${point.label}${activePanel === id ? ' 상세 보기' : ''}`}>
            <div className={s.bubbleControl}><span>{point.number} / {point.label}</span><button type="button" aria-label={activePanel === id ? `${point.label} 상세 보기 닫기` : `${point.label} 패널 확대`} aria-expanded={activePanel === id} onClick={() => activePanel === id ? reset() : select(id)}>{activePanel === id ? '전체 보기 ↙' : '확대 ↗'}</button></div>
            <div className={s.bubbleContent}>{panels[id]}</div>
          </div>;
        })}
      </div>
      <footer className={s.footer}><span>Lily<span className={s.brandDot}>.</span> <span>모니터링</span></span><span>{USE_MOCK ? '데모 모드 · 실제 서비스 상태가 아닙니다' : 'Observability API'} · 시간은 기기 현지 시각</span></footer>
    </main>
  </div>;
}
