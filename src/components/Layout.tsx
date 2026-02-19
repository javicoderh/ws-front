import type { PropsWithChildren, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type LayoutProps = PropsWithChildren<{
  title: string
  subtitle?: string
  actions?: ReactNode
}>

export function Layout({ title, subtitle, actions, children }: LayoutProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-main">
          <Link to="/" className="layout-logo-link" aria-label="Ir al inicio">
            <span className="layout-logo-dot" />
            <span>Workshopia</span>
          </Link>
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="header-actions">{actions}</div> : null}
      </header>
      <main>{children}</main>
    </div>
  )
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null
  }
  return <p className="error-banner">{message}</p>
}

export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <small>{label}</small>
      <p>{value}</p>
    </article>
  )
}
