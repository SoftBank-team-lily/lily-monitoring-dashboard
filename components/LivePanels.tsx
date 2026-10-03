"use client";

import { useI18n } from "@/lib/i18n/provider";

import type { ReactNode } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Monitor, Resource } from '@/lib/project';
import { safeHref } from '@/lib/project';
import s from './dashboard.module.css';

export function ResourceView<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => ReactNode }) {
  const { t, locale } = useI18n();
  return resource.state === 'ready' ? children(resource.data) : <p className={s.empty} data-state={resource.state}>{t(resource.message)}</p>;
}
const format = (value: number, digits = 1) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits });
const time = (value: string, locale: string) => new Date(value).toLocaleTimeString(locale, { hour12: false });
const statusNames: Record<string, string> = { queued: '배포 대기', running: '배포 진행 중', succeeded: '배포 성공', failed: '배포 실패', 'rolled-back': '이전 버전으로 롤백됨' };

export function MetricPanel({ data }: { data: Monitor }) {
  const { t, locale } = useI18n();
  return <section><div className={s.sectionHead}><h2>{t("앱 지표")}</h2><span>{t("최근 1분")}</span></div>
    <ResourceView resource={data.metrics}>{({ current }) => <div className={s.tiles}>
      {[
        [t("분당 요청"), format(current.requestsPerMinute), t("요청/분")],
        [t("서버 오류율"), format(current.errorRate * 100, 2), '% · HTTP 5xx'],
        [t("평균 응답"), format(current.avgLatencyMs), 'ms'],
        [t("p95 응답"), format(current.p95LatencyMs), 'ms'],
      ].map(([label, value, unit]) => <div className={s.tile} key={label}><h3>{t(label)}</h3><div className={s.tileValue}>{value}</div><span className={s.tileCaption}>{t(unit)}</span></div>)}
    </div>}</ResourceView>
    {data.status.state === 'ready' && data.status.data.level === 'HOLD' && <p className={s.hint}>{t("요청 표본이 부족해 상태 판정을 보류했어요. 요청이 없는 구간의 0은 서비스 정상 판정을 의미하지 않아요.")}</p>}
  </section>;
}
export function TrendPanel({ data }: { data: Monitor }) {
  const { t, locale } = useI18n();
  return <section className={s.trends}><div className={s.cardHead}><h2>{t("지표 추이")}</h2><span className={s.muted}>{t("앱 전체 ·")}{" "}{data.window}</span></div>
    <ResourceView resource={data.metrics}>{({ series }) => series.length ? <div className={s.charts}>
      {([['requestsPerMinute', t("분당 요청"), t("요청/분")], ['errorRate', t("오류율"), '%'], ['p95LatencyMs', t("p95 응답"), 'ms']] as const).map(([key, title, unit]) => <div className={s.chartBox} key={key}>
        <h3 className={s.chartHead}>{t(title)} <span className={s.muted}>{t(unit)}</span></h3>
        <div className={s.chartCanvas}><ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <LineChart data={series.map((point) => ({ ...point, errorRate: point.errorRate * 100 }))}>
            <XAxis dataKey="at" tickFormatter={value => time(value, locale)} minTickGap={45} tick={{ fontSize: 10 }} />
            <YAxis width={45} tick={{ fontSize: 10 }} domain={[0, 'auto']} />
            <Tooltip labelFormatter={(label) => time(String(label), locale)} formatter={(value) => [`${format(Number(value), 2)} ${unit}`, title]} />
            <Line type="linear" dataKey={key} stroke="var(--accent)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer></div>
      </div>)}
    </div> : <p className={s.empty}>{t("아직 수집된 시계열이 없어요.")}</p>}</ResourceView>
  </section>;
}
export function DeploymentPanel({ data }: { data: Monitor }) {
  const { t, locale } = useI18n();
  const deployment = data.project.latestDeployment;
  const href = safeHref(deployment?.url);
  const observedUrl = data.app.state === 'ready' ? safeHref(data.app.data.url) : undefined;
  return <section className={s.card}><div className={s.cardHead}><h2>{t("배포와 실행 상태")}</h2></div>
    <p><strong>{t(deployment ? statusNames[deployment.status] ?? deployment.status : "첫 배포 대기")}</strong>{deployment?.stage && ` · ${deployment.stage}`}</p>
    {deployment?.message && <p className={s.hint}>{t(deployment.message)}</p>}
    {href && <a href={href} target="_blank" rel="noreferrer">{t("배포된 앱 열기 ↗")}</a>}
    {!!deployment?.logs.length && <details><summary>{t("빌드 로그 · 최근")}{" "}{deployment.logs.length}{t("줄")}</summary><pre className={s.buildLogs}>{deployment.logs.join('\n')}</pre></details>}
    {data.project.target === 'onprem' && <><h3>{t("내 PC 에이전트")}</h3><ResourceView resource={data.agent}>{(agent) => <p>{agent ? `${agent.agentId ?? t("내 PC")} · ${agent.connected ? t("연결됨") : t("연결 끊김")}` : t("등록된 에이전트가 없어요.")}</p>}</ResourceView></>}
    <h3>{t("현재 실행 중인 앱")}</h3>
    <ResourceView resource={data.app}>{(app) => <><p>{app.strategy} {" "}{t("· 활성 슬롯")}{" "}{app.activeSlot ?? t("미확인")} {" "}{t("· 준비")}{" "}{app.readyReplicas}/{app.replicas}</p>
      <ul className={s.serverList}>{app.deployments.map((item) => <li className={s.server} key={item.name}><strong>{item.slot ?? item.name}</strong><p className={s.hint}>{item.image ?? t("이미지 미확인")} {" "}{t("· 준비")}{" "}{item.readyReplicas}/{item.replicas}</p></li>)}</ul>
    </>}</ResourceView>
    <details><summary>{t("라우팅과 데이터베이스")}</summary>
      <h3>{t("라우팅")}</h3>{data.route.state === 'ready'
        ? <p>{data.route.data.primaryHost} → {data.route.data.serviceName}:{data.route.data.servicePort}{data.route.data.canary ? t(" · 카나리 {{value0}}%", { value0: data.route.data.canary.weight }) : ''}</p>
        : <>{observedUrl && <p><a href={observedUrl} target="_blank" rel="noreferrer">{t("관측된 앱 공개 주소 ↗")}</a></p>}<p className={s.hint}>{t(data.route.message)} {" "}{t("라우트 세부 정보는 조회할 수 없어요.")}</p></>}
      <h3>{t("데이터베이스")}</h3><ResourceView resource={data.databases}>{(items) => items.length ? <ul>{items.map((item) => <li key={item.id}>{item.engine} · {item.status}</li>)}</ul> : <p className={s.hint}>{t("관리형 DB가 등록되지 않았어요. 외부 DB 연결 여부는 앱 설정에서 확인해 주세요.")}</p>}</ResourceView>
    </details>
  </section>;
}
export function PodPanel({ data }: { data: Monitor }) {
  const { t, locale } = useI18n();
  return <section className={s.card}><div className={s.cardHead}><h2>{t("앱 파드와 자원")}</h2></div>
    <ResourceView resource={data.pods}>{(pods) => pods.length ? <ul className={s.serverList}>{pods.map((pod) => <li className={s.server} key={pod.name}>
      <div className={s.serverHead}><strong>{pod.name}</strong><span>{pod.ready ? t("준비됨") : pod.phase}</span></div>
      <p className={s.hint}>CPU {pod.cpuMillicores === null ? t("미수집") : `${format(pod.cpuMillicores)} mCPU`} {" "}{t("· 메모리")}{" "}{pod.memoryMiB === null ? t("미수집") : `${format(pod.memoryMiB)} MiB`}</p>
      <p className={s.hint}>{t("슬롯")}{" "}{pod.slot ?? t("미확인")} {" "}{t("· 재시작")}{" "}{pod.restarts}{t("회 ·")}{" "}{pod.node ?? t("노드 미배정")}</p>
      {(pod.problem || pod.lastRestartReason) && <p className={s.hint} data-status="bad">{pod.problem ?? pod.lastRestartReason}</p>}
    </li>)}</ul> : <p className={s.empty}>{t("실행 중인 파드가 없어요.")}</p>}</ResourceView>
  </section>;
}
export function LogsPanel({ data, level, onLevel }: { data: Monitor; level: 'all' | 'error'; onLevel: (value: 'all' | 'error') => void }) {
  const { t, locale } = useI18n();
  return <section className={s.card}><div className={s.cardHead}><h2>{t("앱 실행 로그")}</h2><label className={s.logFilters}>{t("필터")}{" "}<select value={level} onChange={(event) => onLevel(event.target.value as 'all' | 'error')}><option value="all">{t("전체")}</option><option value="error">{t("오류 포함")}</option></select></label></div>
    <ResourceView resource={data.logs}>{(logs) => logs.length ? <><p className={s.hint}>{t("최근")}{" "}{logs.length}{t("줄 · 최신순 ·")}{" "}{data.window}</p><ol className={s.liveLogs}>{[...logs].reverse().map((log, index) => <li key={`${log.at}:${index}`}>
      <span className={s.muted}>{time(log.at, locale)} · {log.slot ?? log.pod ?? t("앱")}</span><pre>{log.message}</pre>
    </li>)}</ol></> : <p className={s.empty}>{t("해당 기간과 필터에 맞는 로그가 없어요.")}</p>}</ResourceView>
  </section>;
}
