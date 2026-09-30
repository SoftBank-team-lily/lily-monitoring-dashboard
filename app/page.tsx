import { Dashboard } from '@/components/Dashboard';

/** 앱 목록은 우선 환경 변수로. 나중에 GET /api/apps가 생기면 그걸로 바꾼다 */
const apps = (process.env.NEXT_PUBLIC_APPS ?? 'lily-blog-sample')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);

export default function Page() {
  return <Dashboard apps={apps} />;
}
