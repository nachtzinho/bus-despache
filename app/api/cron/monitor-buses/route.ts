import { timingSafeEqual } from 'node:crypto'
import { monitorBusesAtAndreRocha } from '@/lib/bus-monitor'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(request.headers.get('authorization') ?? '')
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await monitorBusesAtAndreRocha()

  return Response.json({
    ok: true,
    eventsProcessed: result.events.length,
    checkedAt: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
