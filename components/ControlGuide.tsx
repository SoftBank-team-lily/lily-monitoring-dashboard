'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import s from './dashboard.module.css';

/** 공간 보기에서 쓰는 조작 방법. [입력, 결과] */
const CONTROLS: [string, string][] = [
  ['패널 제목 드래그', '배치'],
  ['배경 드래그', '회전'],
  ['우클릭 드래그', '이동'],
  ['스크롤', '줌'],
];

/** 좌상단 Lily 아래에 세로로 놓는 조작 방법. 접어 둘 수 있다. */
export function ControlGuide() {
  const { t } = useI18n();
  // 좁은 화면에서는 왼쪽 패널을 가리지 않게 접은 채로 시작한다
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1400);
  return (
    <nav className={s.controlGuide} aria-label={t("조작 방법")} data-open={open}>
      <button type="button" className={s.controlGuideHead} aria-expanded={open} aria-controls="control-guide-list" onClick={() => setOpen((value) => !value)}>
        <span>{t("조작 방법")}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <dl id="control-guide-list" className={s.controlGuideList}>
          {CONTROLS.map(([input, result]) => (
            <div key={input} className={s.controlGuideRow}>
              <dt>{t(input)}</dt>
              <dd>{t(result)}</dd>
            </div>
          ))}
        </dl>
      )}
    </nav>
  );
}
