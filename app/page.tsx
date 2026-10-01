import { headers } from 'next/headers';
import { LoginRedirect } from '@/components/LoginRedirect';
import { frontendGet, frontendLink } from '@/lib/frontend';
import { ProjectDashboard } from '@/components/ProjectDashboard';
import type { Project, ProjectPage } from '@/lib/project';
import s from '@/components/dashboard.module.css';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const id = query.project;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((id !== undefined && (typeof id !== 'string' || !uuid.test(id))) ||
      (query.cursor !== undefined && (typeof query.cursor !== 'string' || !uuid.test(query.cursor))))
    return <Notice message="프로젝트 주소를 확인해 주세요." />;
  const returnTo = id ? `/dashboard?project=${id}` : '/dashboard';
  const loginUrl = frontendLink(`/login?next=${encodeURIComponent(returnTo)}`);
  const verifyUrl = frontendLink('/verify-email');
  const accountUrl = frontendLink('/account');
  const cookie = (await headers()).get('cookie') ?? '';
  const response = await frontendGet(id ? `/api/projects/${id}` : `/api/projects?limit=20${query.cursor ? `&cursor=${query.cursor}` : ''}`, cookie);
  if (response.status === 401) return <LoginRedirect href={loginUrl} />;
  if (response.status === 403) return <LoginRedirect href={verifyUrl} />;
  if (!response.ok) return <Notice message={response.status === 404 ? '프로젝트를 찾을 수 없거나 접근할 수 없어요.' : '프로젝트 서버에 연결하지 못했어요.'} />;
  if (id) return <ProjectDashboard key={id} project={await response.json() as Project} loginUrl={loginUrl} verifyUrl={verifyUrl} accountUrl={accountUrl} />;
  const projects = await response.json() as ProjectPage;
  return <main className={s.main}>
    <div className={s.pageHeading}><div><p className={s.eyebrow}>LILY / MONITORING</p><h1>내 프로젝트</h1><p className={s.subtitle}>상태를 확인할 프로젝트를 선택해 주세요.</p></div><a href={accountUrl}>계정으로 ↗</a></div>
    {projects.items.length ? projects.items.map((project) => <a key={project.id} className={s.card} href={`/dashboard?project=${project.id}`}>
      <h2>{project.name}</h2><p>{project.repo}{project.rootDir ? ` / ${project.rootDir}` : ''}</p>
      <span>{project.target === 'cloud' ? '클라우드' : '내 PC'} · {project.latestDeployment?.status ?? '배포 전'}</span>
    </a>) : <p className={s.empty}>등록된 프로젝트가 없어요. 계정에서 첫 프로젝트를 만들어 주세요.</p>}
    <nav aria-label="프로젝트 목록 페이지"><a href="/dashboard">처음으로</a>{projects.nextCursor && <> · <a href={`/dashboard?cursor=${projects.nextCursor}`}>다음 프로젝트 →</a></>}</nav>
  </main>;
}
function Notice({ message }: { message: string }) {
  return <main className={s.main}><h1>대시보드를 열 수 없어요.</h1><p role="alert">{message}</p><a href={frontendLink('/account')}>내 프로젝트로</a></main>;
}
