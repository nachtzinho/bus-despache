'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BusFront, ArrowRight, LoaderCircle } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export default function SignInPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    const result = mode === 'sign-in'
      ? await authClient.signIn.email({ email: String(form.get('email')), password: String(form.get('password')) })
      : await authClient.signUp.email({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) })
    setPending(false)
    if (result.error) {
      setError('Não foi possível entrar com esses dados. Confira as informações e tente novamente.')
      return
    }
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark"><BusFront size={22} strokeWidth={2.2} /></div>
        <p className="eyebrow">CENTRAL DE OPERAÇÃO</p>
        <h1 id="auth-title">Seu turno, sob controle.</h1>
        <p className="auth-subtitle">Acesse seu painel para acompanhar as linhas 306 e 390.</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'sign-up' && <label>Nome completo<input name="name" autoComplete="name" required maxLength={100} placeholder="Como podemos chamar você?" /></label>}
          <label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@email.com" /></label>
          <label>Senha<input name="password" type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required placeholder="Mínimo de 8 caracteres" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={pending}>
            {pending ? <LoaderCircle className="spin" size={18} /> : <>{mode === 'sign-in' ? 'Entrar no painel' : 'Criar acesso'}<ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-switch">{mode === 'sign-in' ? 'Ainda não tem acesso?' : 'Já tem acesso?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('') }}>
            {mode === 'sign-in' ? 'Criar conta' : 'Fazer login'}
          </button>
        </p>
        <div className="auth-foot"><span>306</span><span>390</span><span>RIO DE JANEIRO</span></div>
      </section>
    </main>
  )
}
