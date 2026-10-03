import { frontendRequest } from '@/lib/frontend';

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function forward(request: Request, context: Context, action: 'project' | 'burst' | 'home' | 'cancel' | 'stop' | 'move') {
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: { message: '프로젝트 주소를 확인해 주세요.' } }, { status: 400 });
  if (action !== 'project') {
    const allowed = [new URL(request.url).origin];
    const publicOrigin = process.env.FRONTEND_AUTH_ORIGIN || process.env.FRONTEND_PUBLIC_URL;
    if (publicOrigin) allowed.push(new URL(publicOrigin).origin);
    if (!allowed.includes(request.headers.get('origin') ?? '') || request.headers.get('sec-fetch-site') === 'cross-site')
      return Response.json({ error: { message: '허용되지 않은 요청입니다.' } }, { status: 403 });
  }
  let body: string | undefined;
  if (action === 'burst' || action === 'home' || action === 'move') {
    if (Number(request.headers.get('content-length')) > 2048)
      return Response.json({ error: { message: '요청이 너무 큽니다.' } }, { status: 413 });
    try {
      body = JSON.stringify(await request.json());
      if (body.length > 2048) throw new Error('large');
    } catch {
      return Response.json({ error: { message: '요청 내용을 확인해 주세요.' } }, { status: 400 });
    }
  }
  const suffix = { project: '', burst: '/burst', home: '/home', cancel: '/home/cancel', stop: '/cloud/stop', move: '/move' }[action];
  const response = await frontendRequest(`/api/projects/${id}${suffix}`, request.headers.get('cookie') ?? '', action === 'project' ? 'GET' : action === 'burst' ? 'PUT' : 'POST', body);
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' },
  });
}

/** 내 PC 에이전트 연결 상태 (클라우드 → 온프레미스 전환 전에 확인). 읽기 전용이라 프로젝트 조회와 같이 출처 검사를 하지 않는다 */
async function agent(request: Request, context: Context) {
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: { message: '프로젝트 주소를 확인해 주세요.' } }, { status: 400 });
  const response = await frontendRequest('/api/agent', request.headers.get('cookie') ?? '', 'GET');
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' },
  });
}

export async function GET(request: Request, context: Context) {
  if (new URL(request.url).searchParams.get('action') === 'agent') return agent(request, context);
  return forward(request, context, 'project');
}
export async function PUT(request: Request, context: Context) { return forward(request, context, 'burst'); }
export async function POST(request: Request, context: Context) {
  const action = new URL(request.url).searchParams.get('action');
  if (action && action !== 'cancel' && action !== 'stop' && action !== 'move')
    return Response.json({ error: { message: '요청을 확인해 주세요.' } }, { status: 400 });
  return forward(request, context, (action || 'home') as 'home' | 'cancel' | 'stop' | 'move');
}
