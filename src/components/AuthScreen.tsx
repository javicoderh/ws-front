import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Layout, ErrorBanner } from './Layout'

type Props = {
  loading: boolean
  error: string | null
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, password: string) => Promise<void>
  onGoogleLogin: (googleIdToken: string) => Promise<void>
  onForgotPassword: (email: string) => Promise<void>
}

export function AuthScreen({ loading, error, onLogin, onSignup, onGoogleLogin, onForgotPassword }: Props) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const [email, setEmail] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(
    googleClientId ? null : 'Falta configurar VITE_GOOGLE_CLIENT_ID.',
  )
  const [googleReady, setGoogleReady] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleInitializedRef = useRef(false)

  useEffect(() => {
    if (!googleClientId) {
      return
    }
    if (!googleButtonRef.current || googleInitializedRef.current) {
      return
    }

    const setupGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        setGoogleError('No se pudo inicializar Google Sign-In.')
        return
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            setGoogleError('Google no devolvio un credential valido.')
            return
          }
          setGoogleError(null)
          void onGoogleLogin(response.credential).catch(() => {
            // Error surfaced in auth context.
          })
        },
      })

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        text: 'continue_with',
        shape: 'pill',
        size: 'large',
        width: 320,
      })
      googleInitializedRef.current = true
      setGoogleReady(true)
    }

    if (window.google?.accounts?.id) {
      setupGoogle()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]')
    if (existing) {
      existing.addEventListener('load', setupGoogle, { once: true })
      return () => existing.removeEventListener('load', setupGoogle)
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = setupGoogle
    script.onerror = () => setGoogleError('No se pudo cargar el SDK de Google.')
    document.head.appendChild(script)
  }, [googleClientId, onGoogleLogin])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    if (!email || !password) {
      return
    }
    if (isSignup) {
      await onSignup(email, password)
      return
    }
    await onLogin(email, password)
  }

  return (
    <Layout
      title="Workshopia"
      subtitle="Autenticacion base para conectar con backend"
      actions={
        <button type="button" onClick={() => setIsSignup((prev) => !prev)}>
          {isSignup ? 'Tengo cuenta' : 'Crear cuenta'}
        </button>
      }
    >
      <section className="section">
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Usuario o Email
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario o usuario@email.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Procesando...' : isSignup ? 'Crear cuenta' : 'Iniciar sesion'}
          </button>
        </form>
        <div className="stack">
          <div ref={googleButtonRef} />
          {!googleReady && !googleError ? <p className="hint">Cargando Google Sign-In...</p> : null}
          {googleError ? <p className="hint">{googleError}</p> : null}
          <label>
            Email para recuperacion
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="usuario@email.com"
            />
          </label>
          <button
            type="button"
            disabled={loading || !resetEmail.trim()}
            onClick={() =>
              void onForgotPassword(resetEmail.trim())
                .then(() => {
                  setFeedback('Email de recuperacion enviado.')
                })
                .catch(() => {
                  // Error surfaced in auth context.
                })
            }
          >
            Recuperar contrasena
          </button>
          {feedback ? <p className="hint">{feedback}</p> : null}
        </div>
        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
