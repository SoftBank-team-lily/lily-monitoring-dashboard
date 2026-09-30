/** 화면 표시용 포맷. 숫자는 고정 자릿수 글꼴 설정(tabular-nums)과 함께 쓴다 */

export function percent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return '없음';
  const v = ratio * 100;
  // 2.0% → 2%, 2.4% → 2.4%
  return `${v < 10 ? String(Number(v.toFixed(1))) : Math.round(v)}%`;
}

export function plainPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return '없음';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

export function count(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 16:02:06 (브라우저 언어 설정과 상관없이 같은 모양) */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function hourMinute(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 차트 눈금이 딱 떨어지도록 1·2·2.5·5 × 10^n 으로 올림 */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const step = [1, 2, 2.5, 5, 10].find((m) => m * base >= value) ?? 10;
  return step * base;
}

export function ago(timestampMs: number, now: number): string {
  const sec = Math.max(0, Math.round((now - timestampMs) / 1000));
  if (sec < 5) return '방금';
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}

/** "5m" → "5분", "1h" → "1시간" */
export function windowLabel(window: string): string {
  const m = window.match(/^(\d+)([smh])$/);
  if (!m) return window;
  return `${m[1]}${{ s: '초', m: '분', h: '시간' }[m[2] as 's' | 'm' | 'h']}`;
}
