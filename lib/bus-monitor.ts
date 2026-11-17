import 'server-only'

import { db } from '@/lib/db'
import { busLogs } from '@/lib/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { ANDRE_ROCHA_POINT, RIO_CENTRO_REFERENCE } from '@/lib/bus-tracking'

const SINGLE_OPERATOR_ID = 'single-operator'
const GPS_ENDPOINT = 'https://its.mobilidade.rio/v1/geolocalizacao/veiculos'
const MAX_GPS_AGE_MS = 2 * 60 * 1000

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const deltaLat = radians(lat2 - lat1)
  const deltaLon = radians(lon2 - lon1)
  const arc = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}

function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const y = Math.sin(radians(lon2 - lon1)) * Math.cos(radians(lat2))
  const x = Math.cos(radians(lat1)) * Math.sin(radians(lat2)) - Math.sin(radians(lat1)) * Math.cos(radians(lat2)) * Math.cos(radians(lon2 - lon1))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function isCenterbound(latitude: number, longitude: number, heading: number) {
  const bearing = bearingDegrees(latitude, longitude, RIO_CENTRO_REFERENCE.latitude, RIO_CENTRO_REFERENCE.longitude)
  const difference = Math.abs(((heading - bearing + 540) % 360) - 180)
  return difference <= 75
}

function localServiceDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp))
}

function localServiceTime(timestamp: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(timestamp))
}

export async function monitorBusesAtAndreRocha() {
  const response = await fetch(GPS_ENDPOINT, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('GPS temporariamente indisponível.')

  const payload = await response.json()
  const currentTime = Date.now()
  const events: string[] = []
  let changed = false

  for (const vehicle of Array.isArray(payload?.data) ? payload.data : []) {
    const route = String(vehicle?.servico ?? '')
    const busNumber = String(vehicle?.id_veiculo ?? '').trim()
    const latitude = Number(vehicle?.latitude)
    const longitude = Number(vehicle?.longitude)
    const heading = vehicle?.direcao === null || vehicle?.direcao === undefined ? Number.NaN : Number(vehicle.direcao)
    const gpsTimestamp = typeof vehicle?.datetime === 'string' ? vehicle.datetime : null
    const gpsTime = gpsTimestamp ? new Date(gpsTimestamp).getTime() : Number.NaN
    if (!['306', '390'].includes(route) || !busNumber || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    if (!Number.isFinite(gpsTime) || currentTime - gpsTime > MAX_GPS_AGE_MS) continue

    const withinPoint = distanceMeters(latitude, longitude, ANDRE_ROCHA_POINT.latitude, ANDRE_ROCHA_POINT.longitude) <= ANDRE_ROCHA_POINT.radiusMeters
    const headingToCenter = Number.isFinite(heading) && isCenterbound(latitude, longitude, heading)
    if (withinPoint && !headingToCenter) continue

    const lockKey = `gps:${route}:${busNumber}`
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`)
      const [activeRecord] = await tx.select({ id: busLogs.id }).from(busLogs).where(and(
        eq(busLogs.userId, SINGLE_OPERATOR_ID),
        eq(busLogs.route, route),
        eq(busLogs.busNumber, busNumber),
        eq(busLogs.point, ANDRE_ROCHA_POINT.name),
        isNull(busLogs.barrierDeparture),
      )).orderBy(desc(busLogs.id)).limit(1)

      if (withinPoint && headingToCenter && !activeRecord && gpsTimestamp) {
        await tx.insert(busLogs).values({
          userId: SINGLE_OPERATOR_ID,
          serviceDate: localServiceDate(gpsTimestamp),
          route,
          busNumber,
          initialDeparture: '',
          barrierArrival: localServiceTime(gpsTimestamp),
          barrierDeparture: null,
          tripMinutes: null,
          point: ANDRE_ROCHA_POINT.name,
          notes: 'Registro automático pela localização GPS do ônibus.',
        })
        events.push(`Linha ${route} · carro ${busNumber}: chegada ${localServiceTime(gpsTimestamp)}`)
        changed = true
      } else if (!withinPoint && activeRecord && gpsTimestamp) {
        await tx.update(busLogs).set({ barrierDeparture: localServiceTime(gpsTimestamp) }).where(eq(busLogs.id, activeRecord.id))
        events.push(`Linha ${route} · carro ${busNumber}: saída ${localServiceTime(gpsTimestamp)}`)
        changed = true
      }
    })
  }

  const logs = changed
    ? await db.select().from(busLogs).where(eq(busLogs.userId, SINGLE_OPERATOR_ID)).orderBy(desc(busLogs.createdAt))
    : null

  return { events, logs }
}
