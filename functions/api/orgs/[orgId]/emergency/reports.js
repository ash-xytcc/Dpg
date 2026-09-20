import { readEmergencyReports } from '../../../_lib/emergency.js';

export async function onRequestGet(ctx) {
  const res = await readEmergencyReports({
    env: ctx.env,
    request: ctx.request,
    orgId: ctx.params.orgId,
    limit: 25,
  });
  if (!res.ok) return res.resp;
  return new Response(JSON.stringify({ reports: res.reports || [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
