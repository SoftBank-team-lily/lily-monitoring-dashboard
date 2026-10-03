'use client';

import { LanguageMenu } from "@/components/i18n/LanguageMenu";
import { useI18n } from "@/lib/i18n/provider";

import { useEffect, useState } from 'react';
import type { Range } from '@/lib/types';
import { ago } from '@/lib/format';
import s from './dashboard.module.css';

interface Props {
  apps: string[]; app: string; onApp: (app: string) => void;
  range: Range; onRange: (range: Range) => void;
  updatedAt?: number; mock: boolean; refreshing: boolean; onRefresh: () => void;
}

export function TopBar({ apps, app, onApp, range, onRange, updatedAt, mock, refreshing, onRefresh }: Props) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <a href="#overview" className={s.skipLink}>{t("모니터링 본문으로 이동")}</a>
      <header className={s.top}>
        <div className={s.topInner}>
          <span className={s.brand}>Lily<span className={s.brandDot}>.</span></span>
          <span className={s.topSlash}>/</span>
          <span className={s.productName}>{t("모니터링")}</span>
          <span className={s.mockChip}>{mock ? t("데모 데이터") : t("API 연결")}</span><LanguageMenu />
        </div>
      </header>
      <div className={s.toolbar}>
        <label className={s.appSelect}>
          <span className={s.srOnly}>{t("앱 선택")}</span>
          <select value={app} onChange={(e) => onApp(e.target.value)}>
            {(apps.length ? apps : [app]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className={s.topRight}>
          <span className={s.updated}>{updatedAt ? t("{{value0}} 갱신", { value0: t(ago(updatedAt, now)) }) : t("연결 중")}</span>
          <div className={s.segmented} role="group" aria-label={t("그래프 조회 기간")}>
            {(['15m', '1h'] as Range[]).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => onRange(r)}>{r === '15m' ? t("15분") : t("1시간")}</button>)}
          </div>
          <button className={s.refresh} type="button" onClick={onRefresh} disabled={refreshing} aria-label={t("모든 패널 새로고침")} title={t("모든 패널 새로고침")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 8a7 7 0 0 1 12-3l3 4M4 15l3 4a7 7 0 0 0 12-3"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}
