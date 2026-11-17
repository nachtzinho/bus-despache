'use server'

import { db } from '@/lib/db'
import { busLogs } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { monitorBusesAtAndreRocha as runBusMonitor } from '@/lib/bus-monitor'
import { revalidatePath } from 'next/cache'

const SINGLE_OPERATOR_ID = 'single-operator'

export async function getLogs() {
  return db.select().from(busLogs).where(eq(busLogs.userId, SINGLE_OPERATOR_ID)).orderBy(desc(busLogs.createdAt))
}

function optionalCount(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > 1000000) throw new Error('Informe uma quantidade válida.')
  return number
}

function optionalText(value: FormDataEntryValue | null, max = 500) {
  const text = String(value ?? '').trim()
  if (text.length > max) throw new Error('Um dos campos excede o limite permitido.')
  return text || null
}

function optionalTime(value: FormDataEntryValue | null) {
  const time = optionalText(value, 5)
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Informe um horário válido.')
  return time
}

function parseLogValues(formData: FormData) {
  const route = String(formData.get('route') ?? '')
  const busNumber = String(formData.get('busNumber') ?? '').trim()
  const serviceDate = String(formData.get('serviceDate') ?? '')
  const initialDeparture = String(formData.get('initialDeparture') ?? '')
  const barrierArrival = optionalTime(formData.get('barrierArrival'))
  const barrierDeparture = optionalTime(formData.get('barrierDeparture'))
  if (!['306', '390'].includes(route)) throw new Error('Selecione uma linha válida.')
  if (!/^\d{1,8}$/.test(busNumber)) throw new Error('Informe um número de carro válido.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error('Informe a data da operação.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(initialDeparture)) throw new Error('Informe o horário de saída.')
  const startMinutes = Number(initialDeparture.slice(0, 2)) * 60 + Number(initialDeparture.slice(3))
  const arrivalMinutes = barrierArrival ? Number(barrierArrival.slice(0, 2)) * 60 + Number(barrierArrival.slice(3)) : null
  const elapsed = arrivalMinutes === null ? null : (arrivalMinutes - startMinutes + 1440) % 1440
  const tripMinutes = elapsed !== null && elapsed > 0 ? elapsed : null

  return {
    userId: SINGLE_OPERATOR_ID,
    route,
    busNumber,
    serviceDate,
    initialDeparture,
    barrierArrival,
    barrierDeparture,
    tripMinutes,
    initialTurnstile: optionalCount(formData.get('initialTurnstile')),
    barrierTurnstile: optionalCount(formData.get('barrierTurnstile')),
    transportPassengers: optionalCount(formData.get('transportPassengers')),
    notes: optionalText(formData.get('notes')),
    company: optionalText(formData.get('company'), 100),
    point: optionalText(formData.get('point'), 100),
    shift: optionalText(formData.get('shift'), 40),
    dispatcher: optionalText(formData.get('dispatcher'), 100),
    endTime: optionalTime(formData.get('endTime')),
  }
}

export async function monitorBusesAtAndreRocha() {
  const result = await runBusMonitor()
  if (result.logs) revalidatePath('/')
  return result
}

async function saveLogs(formDatas: FormData[]) {
  if (!formDatas.length || formDatas.length > 60) throw new Error('Selecione de 1 a 60 viagens para importar.')
  const values = formDatas.map(parseLogValues)
  await db.insert(busLogs).values(values)
  revalidatePath('/')
  return getLogs()
}

export async function createLog(formData: FormData) {
  return saveLogs([formData])
}

export async function createLogs(entries: Array<Record<string, string>>) {
  if (!Array.isArray(entries) || entries.length > 60) throw new Error('Selecione até 60 viagens para importar.')
  const formDatas = entries.map((entry) => {
    const formData = new FormData()
    for (const [key, value] of Object.entries(entry)) {
      if (typeof value !== 'string') throw new Error('Dados de viagem inválidos.')
      formData.set(key, value)
    }
    return formData
  })
  return saveLogs(formDatas)
}

export async function deleteLog(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Registro inválido.')
  await db.delete(busLogs).where(and(eq(busLogs.id, id), eq(busLogs.userId, SINGLE_OPERATOR_ID)))
  revalidatePath('/')
  return getLogs()
}
