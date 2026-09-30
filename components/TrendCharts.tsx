'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppMetrics, Range } from '@/lib/types';
import { clock, count, hourMinute, ms, niceCeil, percent } from '@/lib/format';
import { roleLabel } from './StatusBadge';
import s from './dashboard.module.css';

type MetricKey = 'errorRate' | 'p95Ms' | 'requests';

const META: Record<MetricKey, { title: string; format: (v: number) => string }> = {
  errorRate: { title: '에러율', format: percent },
  p95Ms: { title: '응답 속도 (p95)', format: ms },
  requests: { title: '요청 수', format: (v) => `${count(v)}건` },
};

function Chart({ data, metric }: { data: AppMetrics; metric: MetricKey }) {
  const meta = META[metric];
  const threshold = metric === 'requests' ? null : data.thresholds[metric].bad;
  const rows = data.series.timestamps.map((t, i) => {
    const row: Record<string, string | number | null> = { t };
    for (const v of data.versions) row[v.version] = data.series.byVersion[v.version]?.[metric][i] ?? null;
    return row;
  });
  // 눈금을 딱 떨어지게: 가장 큰 값(기준선 포함)을 4칸으로 나눠 1·2·2.5·5 단위로 올림
  const values = data.versions.flatMap((v) => data.series.byVersion[v.version]?.[metric] ?? []).filter((x): x is number => x !== null);
  const top = Math.max(0, ...values, (threshold ?? 0) * 1.2);
  const step = niceCeil(top / 4);
  const ticks = Array.from({ length: Math.max(1, Math.ceil(top / step)) + 1 }, (_, i) => Number((i * step).toPrecision(6)));

  return (
    <figure className={s.chartBox}>
      <figcaption className={s.chartHead}>
        <span>{meta.title}</span>
        <span className={s.muted}>{metric === 'requests' ? `${data.series.stepSeconds}초당 요청` : metric === 'p95Ms' ? '95번째 백분위' : '요청 중 오류 비율'}</span>
      </figcaption>
      <div className={s.chartCanvas} role="img" aria-label={`${meta.title} 추이 그래프`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="t" tickFormatter={hourMinute} minTickGap={56} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => meta.format(v)}
              width={58}
              tick={{ fontSize: 12, fill: 'var(--text-3)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, ticks[ticks.length - 1]]}
              ticks={ticks}
            />
            <Tooltip
              formatter={(value) => (typeof value === 'number' ? meta.format(value) : '없음')}
              labelFormatter={(label) => clock(String(label))}
              contentStyle={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 5, border: '1px solid var(--line-strong)', fontSize: 12 }}
            />
            {threshold !== null && (
              <ReferenceLine y={threshold} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: '기준', position: 'insideTopLeft', fill: 'var(--bad)', fontSize: 12 }} />
            )}
            {data.versions.map((v) => (
              <Line
                key={v.version}
                dataKey={v.version}
                name={`${roleLabel(v.role)} ${v.version}`}
                type="linear"
                stroke={v.role === 'stable' ? 'var(--stable)' : 'var(--canary)'}
                strokeWidth={v.role === 'canary' ? 2.5 : 2}
                strokeDasharray={v.role === 'canary' ? '6 3' : undefined}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function TrendCharts({ data, range }: { data: AppMetrics; range: Range }) {
  return (
    <section id="trends" className={s.trends} aria-labelledby="trend-title">
      <header className={s.cardHead}>
        <h2 id="trend-title">지표 추이 <span className={s.headingMeta}>최근 {range === '1h' ? '1시간' : '15분'}</span></h2>
        <ul className={s.legend}>
          {data.versions.map((v) => (
            <li key={v.version}>
              <span className={s.line} data-role={v.role} aria-hidden="true" />
              {roleLabel(v.role)} {v.version}
            </li>
          ))}
          <li>
            <span className={s.line} data-role="threshold" aria-hidden="true" />
            기준
          </li>
        </ul>
      </header>
      <div className={s.charts}>
        <Chart data={data} metric="errorRate" />
        <Chart data={data} metric="p95Ms" />
        <Chart data={data} metric="requests" />
      </div>
    </section>
  );
}
