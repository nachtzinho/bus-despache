'use client'

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowDownToLine, ArrowUpRight, BusFront, CalendarDays, Camera, Check, ChevronDown, CircleHelp, Clock3, Download, ExternalLink, FileText, ImagePlus, LayoutDashboard, LoaderCircle, Menu, Plus, Search, Settings2, Trash2, TrendingUp, X } from 'lucide-react'
import { createLog, createLogs, deleteLog } from '@/app/actions/logs'
import { BusTracker } from '@/components/dispatcher/bus-tracker'
import type { getLogs } from '@/app/actions/logs'

type Log = Awaited<ReturnType<typeof getLogs>>[number]

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const fmtDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

type ExtractedRow = {
  route: '306' | '390' | null
  busNumber: string | null
  initialDeparture: string | null
  barrierArrival: string | null
  barrierDeparture: string | null
  initialTurnstile: string | null
  barrierTurnstile: string | null
  transportPassengers: string | null
  notes: string | null
}

type SheetExtraction = {
  serviceDate: string | null
  company: string | null
  point: string | null
  shift: string | null
  rows: ExtractedRow[]
}

function normalizeExtractedDate(value: string | null) {
  if (!value) return today
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return today
  return `${new Date().getFullYear()}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

export function DispatcherDashboard({ initialLogs, userName }: { initialLogs: Log[]; userName: string }) {
  const [logs, setLogs] = useState(initialLogs)
  const [routeFilter, setRouteFilter] = useState('Todas')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [pending, startTransition] = useTransition()
  const [photoPending, setPhotoPending] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoExtraction, setPhotoExtraction] = useState<SheetExtraction | null>(null)
  const [selectedPhotoRows, setSelectedPhotoRows] = useState<number[]>([])
  const [tripMinutes, setTripMinutes] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return
    }
    const previewUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile])

  const todayLogs = useMemo(() => logs.filter((log) => log.serviceDate === today), [logs])
  const visibleLogs = useMemo(() => logs.filter((log) =>
    (routeFilter === 'Todas' || log.route === routeFilter) &&
    `${log.busNumber} ${log.route} ${log.notes ?? ''}`.toLowerCase().includes(search.toLowerCase())
  ), [logs, routeFilter, search])
  const activeBuses = new Set(todayLogs.map((log) => log.busNumber)).size
  const totalPassengers = todayLogs.reduce((sum, log) => sum + (log.transportPassengers ?? 0), 0)
  const averageMinutes = todayLogs.length
    ? Math.round(todayLogs.reduce((sum, log) => sum + (log.tripMinutes ?? 0), 0) / todayLogs.filter((log) => log.tripMinutes !== null).length || 0)
    : 0

  function updateTripDuration(form: HTMLFormElement | null) {
    if (!form) return
    const departure = (form.elements.namedItem('initialDeparture') as HTMLInputElement | null)?.value
    const arrival = (form.elements.namedItem('barrierArrival') as HTMLInputElement | null)?.value
    if (!departure || !arrival) {
      setTripMinutes('')
      return
    }
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    const elapsed = (minutes(arrival) - minutes(departure) + 1440) % 1440
    setTripMinutes(String(elapsed))
  }

  async function readSheetPhoto() {
    if (!photoFile) {
      setPhotoError('Escolha ou tire uma foto da folha primeiro.')
      return
    }
    setPhotoPending(true)
    setPhotoError('')
    setPhotoExtraction(null)
    try {
      const body = new FormData()
      body.set('photo', photoFile)
      const response = await fetch('/api/read-sheet', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível ler a foto.')
      const extraction = result as SheetExtraction
      const rows = extraction.rows.filter((row) => row.busNumber && row.initialDeparture)
      if (!rows.length) throw new Error('Não encontrei viagens legíveis. Tente uma foto mais próxima e nítida.')
      setPhotoExtraction({ ...extraction, rows })
      setSelectedPhotoRows(rows.map((_, index) => index))
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Não foi possível ler a foto.')
    } finally {
      setPhotoPending(false)
    }
  }

  function importPhotoRows() {
    if (!photoExtraction || !formRef.current) return
    const routeInput = formRef.current.elements.namedItem('route') as HTMLSelectElement | null
    const defaultRoute = routeInput?.value === '390' ? '390' : '306'
    const entries = selectedPhotoRows.map((index) => {
      const row = photoExtraction.rows[index]
      return {
        serviceDate: normalizeExtractedDate(photoExtraction.serviceDate),
        route: row.route ?? defaultRoute,
        busNumber: row.busNumber ?? '',
        initialDeparture: row.initialDeparture ?? '',
        barrierArrival: row.barrierArrival ?? '',
        barrierDeparture: row.barrierDeparture ?? '',
        initialTurnstile: row.initialTurnstile ?? '',
        barrierTurnstile: row.barrierTurnstile ?? '',
        transportPassengers: row.transportPassengers ?? '',
        notes: row.notes ?? '',
        company: photoExtraction.company ?? '',
        point: photoExtraction.point ?? '',
        shift: photoExtraction.shift ?? '',
      }
    })
    if (!entries.length) {
      setPhotoError('Selecione ao menos uma viagem para importar.')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        setLogs(await createLogs(entries))
        setPhotoExtraction(null)
        setPhotoFile(null)
        setSelectedPhotoRows([])
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2600)
      } catch (cause) {
        setPhotoError(cause instanceof Error ? cause.message : 'Não foi possível importar as viagens.')
      }
    })
  }

  function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        const updated = await createLog(data)
        setLogs(updated)
        formRef.current?.reset()
        setTripMinutes('')
        setShowForm(false)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2600)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o registro.')
      }
    })
  }

  function removeLog(id: number) {
    startTransition(async () => {
      try { setLogs(await deleteLog(id)) } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o registro.')
      }
    })
  }

  function downloadCsv() {
    const headers = ['Data', 'Linha', 'Carro', 'Saída inicial', 'Chegada barreira', 'Saída barreira', 'Tempo viagem (min)', 'Roleta inicial', 'Roleta barreira', 'Passageiros transportados', 'Observação']
    const rows = visibleLogs.map((log) => [log.serviceDate, log.route, log.busNumber, log.initialDeparture, log.barrierArrival ?? '', log.barrierDeparture ?? '', log.tripMinutes ?? '', log.initialTurnstile ?? '', log.barrierTurnstile ?? '', log.transportPassengers ?? '', log.notes ?? ''])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-despacho-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#inicio" aria-label="Despacho, início">
          <span className="brand-mark"><BusFront size={21} /></span>
          <span className="brand-name">despacho<span>.</span><small>OPERAÇÃO URBANA</small></span>
        </a>
        <div className="nav-label">MENU PRINCIPAL</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <a className="nav-link nav-active" href="#inicio" onClick={() => setMobileNav(false)}><LayoutDashboard size={18} />Visão geral</a>
          <a className="nav-link" href="#registros" onClick={() => setMobileNav(false)}><FileText size={18} />Relatórios<span className="nav-count">{logs.length}</span></a>
          <button className="nav-link" onClick={() => { setShowForm(true); setMobileNav(false) }}><Plus size={18} />Novo registro</button>
        </nav>
        <div className="sidebar-routes">
          <div className="nav-label">SUAS LINHAS <Settings2 size={15} aria-hidden="true" /></div>
          <button className={`route-nav ${routeFilter === '306' ? 'route-selected' : ''}`} onClick={() => setRouteFilter(routeFilter === '306' ? 'Todas' : '306')}><span className="route-dot route-dot-blue" />306 <span className="route-caption">Monitorada</span></button>
          <button className={`route-nav ${routeFilter === '390' ? 'route-selected' : ''}`} onClick={() => setRouteFilter(routeFilter === '390' ? 'Todas' : '390')}><span className="route-dot route-dot-orange" />390 <span className="route-caption">Monitorada</span></button>
        </div>
        <div className="sidebar-bottom">
          <div className="help-box"><span className="help-icon"><CircleHelp size={17} /></span><strong>Precisa de ajuda?</strong><p>Seu relatório pode ser exportado para planilha a qualquer momento.</p><button onClick={downloadCsv}>Exportar agora <ArrowUpRight size={14} /></button></div>
          <div className="profile-row"><div className="avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{userName}</strong><span>Despachante</span></div></div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}
      <section className="workspace" id="inicio">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Operação</span><span className="crumb-slash">/</span><strong>Visão geral</strong></div>
          <div className="topbar-right"><span className="live-indicator"><i /> Operação do dia</span><span className="topbar-divider" /><div className="topbar-date"><CalendarDays size={16} />{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</div><span className="avatar top-avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span></div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div><p className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).toUpperCase()} · RIO DE JANEIRO</p><h1>Bom turno, {userName.split(' ')[0]} <span className="wave-mark">—</span></h1><p className="welcome-sub">Acompanhe a operação e mantenha seus registros em dia.</p></div>
            <button className="button button-primary new-entry" onClick={() => setShowForm((show) => !show)}><Plus size={18} />{showForm ? 'Fechar formulário' : 'Registrar viagem'}</button>
          </div>

          {saved && <div className="success-banner" role="status"><Check size={17} />Viagem registrada com sucesso.</div>}

          <section className="route-strip" aria-label="Linhas em operação">
            <div className="route-strip-title"><span className="strip-icon"><BusFront size={18} /></span><div><strong>Linhas monitoradas</strong><small>2 linhas sob sua responsabilidade</small></div></div>
            <div className="route-chip route-chip-blue"><span>306</span><small>MONITORADA</small><i /></div>
            <div className="route-chip route-chip-orange"><span>390</span><small>MONITORADA</small><i /></div>
            <a className="external-link" href="https://play.google.com/store/search?q=la%20vem%20%C3%B4nibus&c=apps" target="_blank" rel="noreferrer">Abrir Lá Vem <ExternalLink size={15} /></a>
          </section>

          <div className="live-note"><span className="note-mark"><CircleHelp size={15} /></span><span>O mapa usa posições públicas da Prefeitura do Rio e atualiza automaticamente. Confira o horário da última atualização.</span><button aria-label="Fechar aviso" onClick={(event) => event.currentTarget.parentElement?.remove()}><X size={15} /></button></div>

          <BusTracker onRecordsUpdated={setLogs} />

          <section className="metrics-grid" aria-label="Resumo da operação de hoje">
            <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-blue"><BusFront size={18} /></span><span className="metric-caption">HOJE</span></div><p className="metric-label">Carros registrados</p><div className="metric-value">{activeBuses}<span> veículos</span></div><div className="metric-foot"><span className="metric-foot-dot blue-dot" />{todayLogs.length} viagens anotadas</div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-green"><TrendingUp size={18} /></span><span className="metric-caption">HOJE</span></div><p className="metric-label">Passageiros transportados</p><div className="metric-value">{totalPassengers.toLocaleString('pt-BR')}</div><div className="metric-foot">Soma dos registros informados</div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-orange"><Clock3 size={18} /></span><span className="metric-caption">MÉDIA</span></div><p className="metric-label">Tempo de viagem</p><div className="metric-value">{averageMinutes}<span> min</span></div><div className="metric-foot">Com base nas viagens cronometradas</div></article>
            <article className="metric-card metric-highlight"><div className="metric-top"><span className="metric-icon metric-icon-white"><CalendarDays size={18} /></span><span className="metric-caption">RELATÓRIO</span></div><p className="metric-label">Folha do dia</p><div className="metric-value">{todayLogs.length}<span> registros</span></div><button className="metric-action" onClick={downloadCsv}>Baixar relatório <ArrowDownToLine size={15} /></button></article>
          </section>

          {showForm && <section className="entry-card" aria-labelledby="entry-title">
            <div className="section-heading entry-heading"><div><p className="eyebrow">NOVO LANÇAMENTO</p><h2 id="entry-title">Registrar viagem</h2><p>Os campos seguem o formato da sua folha de horários.</p></div><button className="icon-button close-form" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={18} /></button></div>
            <form ref={formRef} className="entry-form" onSubmit={submitLog}>
              <section className="photo-import" aria-labelledby="photo-title">
                <div className="photo-import-heading"><div><strong id="photo-title">Preencher pela foto da folha</strong><p>Tire uma foto ou escolha uma imagem. Confira os dados antes de importar.</p></div><Camera size={20} aria-hidden="true" /></div>
                <div className="photo-controls">
                  <input ref={photoInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Selecionar foto da folha" onChange={(event) => { setPhotoFile(event.currentTarget.files?.[0] ?? null); setPhotoExtraction(null); setPhotoError('') }} />
                  <button type="button" className="button button-outline" onClick={() => photoInputRef.current?.click()}><ImagePlus size={16} />{photoFile ? 'Trocar foto' : 'Tirar ou escolher foto'}</button>
                  {photoFile && <button type="button" className="button button-primary" onClick={readSheetPhoto} disabled={photoPending}>{photoPending ? <><LoaderCircle size={16} className="spin" />Lendo foto…</> : 'Ler dados da foto'}</button>}
                </div>
                {photoPreview && <img className="photo-preview" src={photoPreview} alt="Prévia da foto da folha selecionada" />}
                <p className="photo-privacy">A foto é usada apenas para leitura e não fica salva no histórico.</p>
                {photoError && <p className="form-error" role="alert">{photoError}{photoError.includes('AI Gateway') && <> <a className="ai-setup-link" href="https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card" target="_blank" rel="noreferrer">Ativar leitura por foto</a></>}</p>}
                {photoExtraction && <div className="extracted-list" aria-live="polite">
                  <div className="extracted-heading"><div><strong>{photoExtraction.rows.length} viagens identificadas</strong><span>{[photoExtraction.serviceDate, photoExtraction.company, photoExtraction.point, photoExtraction.shift].filter(Boolean).join(' · ') || 'Confira a data e os dados da folha'}</span></div><button type="button" className="icon-button" onClick={() => setPhotoExtraction(null)} aria-label="Fechar dados identificados"><X size={17} /></button></div>
                  <p className="extracted-hint">Marque as viagens que quer importar. Se a linha não estiver na folha, será usada a linha selecionada no formulário.</p>
                  <div className="extracted-rows">
                    {photoExtraction.rows.map((row, index) => <label className="extracted-row" key={`${row.busNumber}-${row.initialDeparture}-${index}`}>
                      <input type="checkbox" checked={selectedPhotoRows.includes(index)} onChange={(event) => setSelectedPhotoRows((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))} />
                      <span className={`line-tag ${row.route === '390' ? 'line-tag-orange' : 'line-tag-blue'}`}>{row.route ?? 'linha?'}</span>
                      <strong>Carro {row.busNumber}</strong><span>{row.initialDeparture} → {row.barrierArrival ?? '—'}</span>
                      {row.barrierArrival && row.initialDeparture && <small>{(() => { const start = Number(row.initialDeparture.slice(0, 2)) * 60 + Number(row.initialDeparture.slice(3)); const end = Number(row.barrierArrival.slice(0, 2)) * 60 + Number(row.barrierArrival.slice(3)); return `${(end - start + 1440) % 1440} min` })()}</small>}
                    </label>)}
                  </div>
                  <button type="button" className="button button-primary import-photo" onClick={importPhotoRows} disabled={pending || selectedPhotoRows.length === 0}><Check size={16} />Importar {selectedPhotoRows.length} viagens</button>
                </div>}
              </section>
              <div className="form-section-label">DADOS DA OPERAÇÃO</div>
              <div className="form-grid form-grid-main">
                <label>Data da operação<input name="serviceDate" type="date" defaultValue={today} required /></label>
                <label>Linha<select name="route" defaultValue="306"><option value="306">306</option><option value="390">390</option></select></label>
                <label>Nº do carro<input name="busNumber" inputMode="numeric" pattern="[0-9]{1,8}" placeholder="Ex.: 036" required /></label>
                <label>Saída inicial<input name="initialDeparture" type="time" required onChange={(event) => updateTripDuration(event.currentTarget.form)} /></label>
              </div>
              <div className="form-section-label form-section-spaced">BARREIRA E VIAGEM</div>
              <div className="form-grid">
                <label>Chegada barreira<input name="barrierArrival" type="time" onChange={(event) => updateTripDuration(event.currentTarget.form)} /></label>
                <label>Saída barreira<input name="barrierDeparture" type="time" /></label>
                <label>Tempo de viagem (min)<input name="tripMinutes" type="number" min="0" max="1440" placeholder="Calculado ao informar chegada" value={tripMinutes} readOnly aria-describedby="trip-duration-help" /><small id="trip-duration-help" className="field-hint">Calculado pela saída e chegada à barreira</small></label>
                <label>Horário final<input name="endTime" type="time" /></label>
              </div>
              <div className="form-section-label form-section-spaced">ROLETAS E OBSERVAÇÕES</div>
              <div className="form-grid">
                <label>Roleta inicial<input name="initialTurnstile" type="number" min="0" placeholder="0" /></label>
                <label>Roleta barreira<input name="barrierTurnstile" type="number" min="0" placeholder="0" /></label>
                <label>Passageiros transportados<input name="transportPassengers" type="number" min="0" placeholder="0" /></label>
                <label>Empresa<input name="company" placeholder="Ex.: empresa operadora" maxLength={100} /></label>
                <label>Ponto<input name="point" placeholder="Ex.: 863" maxLength={100} /></label>
                <label>Turno<input name="shift" placeholder="Ex.: 2º turno" maxLength={40} /></label>
                <label>Despachante<input name="dispatcher" placeholder="Nome do responsável" maxLength={100} /></label>
                <label className="notes-field">Observação<input name="notes" placeholder="Atraso, ocorrência ou informação importante" maxLength={500} /></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="form-actions"><span>Você pode completar os dados de roleta depois.</span><button className="button button-primary" disabled={pending}>{pending ? 'Salvando...' : <><Check size={17} />Salvar viagem</>}</button></div>
            </form>
          </section>}

          <section className="records-section" id="registros">
            <div className="section-heading records-heading"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Registro de viagens <span className="record-count">{visibleLogs.length}</span></h2></div><div className="table-tools"><label className="search-box"><Search size={16} /><input aria-label="Buscar por carro, linha ou observação" placeholder="Buscar registro..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button button-outline export-button" onClick={downloadCsv}><Download size={16} />Exportar <ChevronDown size={14} /></button></div></div>
            <div className="filter-row"><span>Exibindo <strong>{routeFilter === 'Todas' ? 'todas as linhas' : `linha ${routeFilter}`}</strong></span><div className="filter-pills" aria-label="Filtrar registros por linha">{['Todas', '306', '390'].map((route) => <button key={route} className={routeFilter === route ? 'filter-pill filter-pill-active' : 'filter-pill'} onClick={() => setRouteFilter(route)}>{route}</button>)}</div></div>
            <div className="table-wrap"><table><thead><tr><th>DATA</th><th>LINHA / CARRO</th><th>SAÍDA INICIAL</th><th>CHEGADA BARREIRA</th><th>SAÍDA BARREIRA</th><th>TEMPO</th><th>PASSAGEIROS</th><th>OBSERVAÇÃO</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
              {visibleLogs.map((log) => <tr key={log.id}><td className="date-cell">{fmtDate(log.serviceDate)}</td><td><span className={`line-tag ${log.route === '306' ? 'line-tag-blue' : 'line-tag-orange'}`}>{log.route}</span><span className="bus-id">{log.busNumber}</span></td><td className="time-cell">{log.initialDeparture}</td><td className="time-cell">{log.barrierArrival || '—'}</td><td className="time-cell">{log.barrierDeparture || '—'}</td><td>{log.tripMinutes ? `${log.tripMinutes} min` : '—'}</td><td>{log.transportPassengers?.toLocaleString('pt-BR') ?? '—'}</td><td className="notes-cell">{log.notes || '—'}</td><td><button className="row-delete" aria-label={`Excluir viagem do carro ${log.busNumber}`} onClick={() => removeLog(log.id)} disabled={pending}><Trash2 size={15} /></button></td></tr>)}
              {visibleLogs.length === 0 && <tr><td colSpan={9}><div className="empty-state"><span className="empty-icon"><FileText size={21} /></span><strong>{logs.length ? 'Nenhum registro encontrado' : 'Sua operação começa aqui'}</strong><p>{logs.length ? 'Tente outra busca ou filtro de linha.' : 'Registre a primeira viagem para preencher seu relatório do dia.'}</p>{!logs.length && <button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} />Registrar primeira viagem</button>}</div></td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Atualizado agora</span><button onClick={downloadCsv}><Download size={14} /> Baixar planilha CSV</button><span className="footer-secure"><i /> Dados salvos com segurança</span></div>
          </section>
          <footer className="page-footer"><span>DESPACHO · OPERAÇÃO URBANA</span><span>Feito para quem mantém o Rio em movimento.</span><a href="https://play.google.com/store/search?q=la%20vem%20%C3%B4nibus&c=apps" target="_blank" rel="noreferrer">Lá Vem o Ônibus <ExternalLink size={13} /></a></footer>
        </div>
      </section>
    </main>
  )
}
