import { frontendGet } from '@/lib/frontend';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return Response.json({ error: { message: '프로젝트 주소를 확인해 주세요.' } }, { status: 400 });
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ['window', 'level']) if (incoming.has(key)) query.set(key, incoming.get(key)!);
  const response = await frontendGet(`/api/projects/${id}/monitor?${query}`, request.headers.get('cookie') ?? '');
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' },
  });
}
