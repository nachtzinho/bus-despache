import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GPS_ENDPOINT = 'https://its.mobilidade.rio/v1/geolocalizacao/veiculos'

export async function GET() {
  try {
    const response = await fetch(GPS_ENDPOINT, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'O serviço de GPS está indisponível.' }, { status: 502 })
    }

    const payload = await response.json()
    const vehicles = Array.isArray(payload?.data) ? payload.data : []
    const latestByBus = new Map<string, {
      id: string
      route: '306' | '390'
      direction: string
      latitude: number
      longitude: number
      speed: number | null
      updatedAt: string | null
    }>()

    for (const vehicle of vehicles) {
      const route = String(vehicle?.servico ?? '')
      const id = String(vehicle?.id_veiculo ?? '')
      const latitude = Number(vehicle?.latitude)
      const longitude = Number(vehicle?.longitude)
      if (!['306', '390'].includes(route) || !id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
      const item = {
        id,
        route: route as '306' | '390',
        direction: String(vehicle?.sentido ?? 'não informado'),
        latitude,
        longitude,
        speed: Number.isFinite(Number(vehicle?.velocidade)) ? Number(vehicle.velocidade) : null,
        updatedAt: typeof vehicle?.datetime === 'string' ? vehicle.datetime : null,
      }
      const current = latestByBus.get(id)
      if (!current || (item.updatedAt ?? '') > (current.updatedAt ?? '')) latestByBus.set(id, item)
    }

    return NextResponse.json({
      vehicles: [...latestByBus.values()],
      updatedAt: typeof payload?.minuto_utc === 'string' ? payload.minuto_utc : new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o GPS agora.' }, { status: 502 })
  }
}
