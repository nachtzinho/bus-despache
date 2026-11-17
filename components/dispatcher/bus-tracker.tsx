'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { BusFront, ExternalLink, MapPin, RefreshCw } from 'lucide-react'
import { monitorBusesAtAndreRocha } from '@/app/actions/logs'
import type { getLogs } from '@/app/actions/logs'

type Log = Awaited<ReturnType<typeof getLogs>>[number]

type Vehicle = {
  id: string
  route: '306' | '390'
  direction: string
  latitude: number
  longitude: number
  speed: number | null
  updatedAt: string | null
}

type BusPayload = { vehicles: Vehicle[]; updatedAt: string }

const BusMap = dynamic(() => import('./bus-map'), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Carregando mapa…</div>,
})

async function fetchBuses(url: string): Promise<BusPayload> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('GPS indisponível')
  return response.json()
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
}

export function BusTracker({ onRecordsUpdated }: { onRecordsUpdated?: (logs: Log[]) => void }) {
  const { data, error, isLoading, mutate } = useSWR<BusPayload>('/api/buses', fetchBuses, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
  const [automationEvent, setAutomationEvent] = useState('')
  const lastMonitorRef = useRef<string | null>(null)
  const vehicles = data?.vehicles ?? []
  const lastUpdated = data?.updatedAt ? timeLabel(data.updatedAt) : null

  useEffect(() => {
    if (!data?.updatedAt || lastMonitorRef.current === data.updatedAt) return
    lastMonitorRef.current = data.updatedAt
    let active = true

    monitorBusesAtAndreRocha().then((result) => {
      if (!active) return
      if (result.logs) onRecordsUpdated?.(result.logs)
      if (result.events.length) setAutomationEvent(result.events.join(' · '))
    }).catch(() => {
      if (active) setAutomationEvent('GPS indisponível; a automação tentará novamente na próxima atualização.')
    })

    return () => { active = false }
  }, [data?.updatedAt, onRecordsUpdated])

  return (
    <section className="gps-card" aria-labelledby="gps-title">
      <div className="gps-heading">
        <div className="gps-title-wrap">
          <span className="gps-icon"><MapPin size={18} /></span>
          <div><p className="eyebrow">LOCALIZAÇÃO AO VIVO</p><h2 id="gps-title">Ônibus no mapa</h2><p className="gps-caption">Dados públicos da Prefeitura do Rio · linhas 306 e 390</p></div>
        </div>
        <div className="gps-actions">
          <span className="gps-count">{isLoading ? 'Buscando…' : `${vehicles.length} ${vehicles.length === 1 ? 'carro' : 'carros'}`}</span>
          <button className="icon-button gps-refresh" onClick={() => mutate()} aria-label="Atualizar localização dos ônibus"><RefreshCw size={16} /></button>
        </div>
      </div>
      {error && <div className="gps-empty gps-empty-compact" role="status"><BusFront size={21} /><strong>GPS temporariamente indisponível</strong><span>Tente atualizar em instantes ou abra o Lá Vem o Ônibus.</span><a href="https://play.google.com/store/search?q=la%20vem%20%C3%B4nibus&c=apps" target="_blank" rel="noreferrer">Abrir aplicativo <ExternalLink size={14} /></a></div>}
      <BusMap vehicles={vehicles} />
      {!error && !vehicles.length && <div className="gps-empty gps-empty-compact"><BusFront size={21} /><strong>{isLoading ? 'Buscando ônibus…' : 'Nenhum ônibus localizado agora'}</strong><span>O ponto de detecção segue marcado no mapa.</span></div>}
      <p className="gps-monitor-note"><i aria-hidden="true" /> Monitorando chegada e saída no ponto André Rocha, sentido Centro. No servidor, o GPS é verificado automaticamente a cada minuto.</p>
      {automationEvent && <p className="gps-automation-event" role="status">{automationEvent}</p>}
      <div className="gps-footer">
        <div className="gps-legend"><span><i className="gps-blue" /> Linha 306</span><span><i className="gps-orange" /> Linha 390</span></div>
        {lastUpdated && <span className="gps-updated">Atualizado às {lastUpdated}</span>}
      </div>
    </section>
  )
}
