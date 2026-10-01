import 'server-only';

/** 신뢰하는 내부 프런트 서버에만 세션을 전달한다. 브라우저가 대상 URL을 정하지 않는다. */
export async function frontendGet(path: string, cookie: string): Promise<Response> {
  const origin = process.env.FRONTEND_URL;
  if (!origin) return Response.json({ error: { message: '로그인 서비스 연결이 필요해요.' } }, { status: 503 });
  try {
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid origin');
    return await fetch(new URL(path, base), {
      headers: { cookie }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
  } catch {
    return Response.json({ error: { message: '프로젝트 서버에 연결하지 못했어요.' } }, { status: 502 });
  }
}
export function frontendLink(path: string) {
  // 기본값은 동일 공개 origin. 별도 포트에서 직접 열 때만 공개 프런트 origin을 지정한다.
  const origin = process.env.FRONTEND_PUBLIC_URL;
  if (!origin) return path;
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid frontend public URL');
  return new URL(path, url).href;
}
