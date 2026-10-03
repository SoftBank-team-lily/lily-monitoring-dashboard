"use client";

import { LanguageMenu } from "@/components/i18n/LanguageMenu";
import { useI18n } from "@/lib/i18n/provider";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OBSERVATION_POINTS, type PanelId } from '@/lib/flower-particles';
import type { Monitor, Project } from '@/lib/project';
import { DeploymentPanel, LogsPanel, MetricPanel, PodPanel, TrendPanel } from './LivePanels';
import { TrafficPanel } from './TrafficPanel';
import s from './dashboard.module.css';

const ParticleStage = dynamic(() => import('./ParticleStage'), { ssr: false });
const labels: Record<PanelId, string> = { metrics: '앱 지표', trends: '지표 추이', compare: '배포와 실행 상태', servers: '앱 파드와 자원', logs: '앱 실행 로그', traffic: '거점과 트래픽' };
class RequestError extends Error { constructor(public status: number) { super('데이터를 불러오지 못했어요.'); } }

export function ProjectDashboard({ project, loginUrl, verifyUrl, accountUrl }: { project: Project; loginUrl: string; verifyUrl: string; accountUrl: string }) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<'spatial' | 'list'>('spatial');
  const [wide, setWide] = useState(false);
  const [active, setActive] = useState<PanelId | null>(null);
  const [range, setRange] = useState('15m');
  const [level, setLevel] = useState<'all' | 'error'>('all');
  const returnFocus = useRef<HTMLElement | null>(null);
  const cache = useQueryClient();
  const query = useQuery<Monitor, RequestError>({
    queryKey: ['project-monitor', project.id, range, level],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/dashboard/api/projects/${project.id}/monitor?window=${range}&level=${level}`, { cache: 'no-store', signal });
      if (!response.ok) throw new RequestError(response.status);
      return response.json();
    },
    refetchInterval: (state) => state.state.error && [401, 403, 404].includes(state.state.error.status) ? false
      : ['queued', 'running'].includes(state.state.data?.project.latestDeployment?.status ?? '') ? 5000 : 15000,
    retry: (count, error) => ![401, 403, 404].includes(error.status) && count < 1,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    if (!query.error || ![401, 403].includes(query.error.status)) return;
    cache.clear(); window.location.replace(query.error.status === 401 ? loginUrl : verifyUrl);
  }, [query.error, cache, loginUrl, verifyUrl]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setWide(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { setActive(null); returnFocus.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  function select(id: PanelId) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(id);
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(`[data-panel="${id}"]`);
      panel?.focus({ preventScroll: true });
      if (!wide || view === 'list') panel?.scrollIntoView({ block: 'start' });
    });
  }
  function reset() { setActive(null); requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); }
  const data = query.isError ? undefined : query.data;
  const fallback = <p className={query.isError ? s.failure : s.loading} role={query.isError ? 'alert' : 'status'}>
    {query.error?.status === 404 ? t("프로젝트가 삭제되었거나 접근할 수 없어요.") : query.isError ? t("프로젝트 상태를 가져오지 못했어요. 새로고침해 주세요.") : t("프로젝트 상태를 불러오는 중…")}
  </p>;
  const panels: Record<PanelId, ReactNode> = data ? {
    metrics: <MetricPanel data={data} />, trends: <TrendPanel data={data} />,
    compare: <DeploymentPanel data={data} />, servers: <PodPanel data={data} />,
    logs: <LogsPanel data={data} level={level} onLevel={setLevel} />,
    traffic: <TrafficPanel project={project} />,
  } : { metrics: fallback, trends: fallback, compare: fallback, servers: fallback, logs: fallback, traffic: <TrafficPanel project={project} /> };
  const status = data?.status.state === 'ready' ? data.status.data : null;
  return <div className={`${s.page} ${view === 'spatial' ? s.spatial : ''}`}>
    <a className={s.skipLink} href="#overview">{t("모니터링 본문으로 이동")}</a>
    <header className={s.top}><div className={s.topInner}><a className={s.brand} href={accountUrl}>Lily<span className={s.brandDot}>.</span></a><a href="/dashboard">{t("내 프로젝트 ↗")}</a><LanguageMenu /></div></header>
    <div className={s.toolbar}><span className={s.projectName} title={`${project.repo}/${project.rootDir}`}>{project.target === 'onprem' ? t("내 PC · ") : ''}{project.name}</span><div className={s.segmented} role="group" aria-label={t("조회 기간")}>{[['5m', t("5분")], ['15m', t("15분")], ['1h', t("1시간")]].map(([value, label]) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{t(label)}</button>)}</div><button className={s.refresh} disabled={query.isFetching} onClick={() => void query.refetch()} aria-label={t("모든 패널 새로고침")}>↻</button></div>
    <main className={s.main} id="overview" tabIndex={-1}>
      <div className={s.pageHeading}><div><p className={s.eyebrow}>{project.target === 'cloud' ? 'CLOUD' : 'ON PREMISE'}</p><h1>{project.name}</h1><p className={s.subtitle}>{project.repo}{project.rootDir ? ` / ${project.rootDir}` : ''}</p></div><div className={s.viewControls}><div className={s.segmented} role="group" aria-label={t("대시보드 보기")}><button aria-pressed={view === 'spatial'} onClick={() => { setView('spatial'); setActive(null); }}>{t("공간 보기")}</button><button aria-pressed={view === 'list'} onClick={() => { setView('list'); setActive(null); }}>{t("목록 보기")}</button></div></div></div>
      <div className={s.hero} aria-label={t("현재 관측 상태")} aria-live="polite" data-status={status?.level === 'CRITICAL' ? 'bad' : status?.level === 'WARNING' ? 'warn' : 'neutral'}><div className={s.heroText}><h2>{t(status?.message ?? (data?.status.state !== 'ready' ? data?.status.message : null) ?? '상태 확인 중')}</h2><p>{status ? t("{{value0}} · 권장 조치: {{value1}}", { value0: t(status.reason), value1: t(status.action) }) : t("배포 상태와 관측 연결 상태는 각각 확인할 수 있어요.")}</p></div></div>
      <div className={s.layout}>
        {view === 'spatial' && wide ? <ParticleStage app={project.name} active={active} panels={panels} labels={Object.fromEntries(Object.entries(labels).map(([id, label]) => [id, t(label)]))} onSelect={select} onReset={reset} /> : OBSERVATION_POINTS.map(({ id, number }) => <div key={id} className={s.scenePanel} data-panel={id} data-selected={active === id || undefined} tabIndex={-1} aria-label={t(labels[id])}><div className={s.bubbleControl}><span>{number} / {t(labels[id])}</span><button onClick={() => active === id ? reset() : select(id)} aria-expanded={active === id}>{active === id ? t("전체 보기 ↙") : t("확대 ↗")}</button></div><div className={s.bubbleContent}>{panels[id]}</div></div>)}
      </div>
      <footer className={s.footer}><span>{project.target === 'cloud' ? t("클라우드") : t("내 PC")} · {data?.appName ?? t("앱 매핑 대기")}</span><span>{data ? t("{{value0}} 조회", { value0: new Date(data.generatedAt).toLocaleTimeString(locale) }) : t("연결 중")} {" "}{t("· 배포 중 5초 / 평상시 15초 갱신")}</span></footer>
    </main>
  </div>;
}
