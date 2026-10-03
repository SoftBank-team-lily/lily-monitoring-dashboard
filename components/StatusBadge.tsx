"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Role, Status } from '@/lib/types';
import s from './dashboard.module.css';

const LABEL: Record<Status, string> = { ok: '정상', warn: '주의', bad: '위험', unknown: '판단 보류' };

export const statusLabel = (status: Status) => LABEL[status];
export const roleLabel = (role: Role) => (role === 'stable' ? '기존 버전' : '새 버전');

const ICON_PATH: Record<Status, string> = {
  ok: 'M5 8.3l2.1 2.1L11.2 6',
  warn: 'M8 4.6v4.2M8 11.3v.2',
  bad: 'M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6',
  unknown: 'M5.2 8h5.6',
};

/** 상태는 색 + 모양으로 전달한다 (색을 구분하기 어려운 사람도 알아볼 수 있게) */
export function StatusIcon({ status, size = 16 }: { status: Status; size?: number }) {
  return (
    <svg className={s.icon} data-status={status} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" />
      <path d={ICON_PATH[status]} />
    </svg>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  return (
    <span className={s.badge} data-status={status}>
      <StatusIcon status={status} size={14} />
      {t(LABEL[status])}
    </span>
  );
}
