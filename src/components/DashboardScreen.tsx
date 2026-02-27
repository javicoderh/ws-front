import { useMemo, useState } from 'react'
import { Layout, ErrorBanner, InfoCard } from './Layout'
import type { UserEscalatedCaseItem, UserHelperSessionItem, WorkshopRecord } from '../types/backend'
import { buildWorkshopSummary, formatEpoch } from '../utils/workshopSummary'

type Props = {
  balance: number | null
  helperSessions: UserHelperSessionItem[]
  escalatedCases: UserEscalatedCaseItem[]
  generatedWorkshops: WorkshopRecord[]
  loading: boolean
  error: string | null
  noticeMessage?: string | null
  noticePrimaryLabel?: string | null
  noticeSecondaryLabel?: string | null
  onRefresh: () => Promise<void>
  onStartHelper: () => Promise<void>
  onOpenSession: (sessionId: string) => Promise<void>
  onNoticePrimary?: () => Promise<void> | void
  onNoticeSecondary?: () => void
  onGoPurchase: () => void
  onGoProfile: () => void
  onGoHistory: () => void
  onChangePassword: (newPassword: string) => Promise<void>
  onLogout: () => void
}

export function DashboardScreen({
  balance,
  helperSessions,
  escalatedCases,
  generatedWorkshops,
  loading,
  error,
  noticeMessage,
  noticePrimaryLabel,
  noticeSecondaryLabel,
  onRefresh,
  onStartHelper,
  onOpenSession,
  onNoticePrimary,
  onNoticeSecondary,
  onGoPurchase,
  onGoProfile,
  onGoHistory,
  onChangePassword,
  onLogout,
}: Props) {
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopRecord | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const statusLabel = (status: string) => {
    if (status === 'waiting_admin') return 'Esperando revisión de admin'
    if (status === 'in_review') return 'En revisión'
    if (status === 'resolved') return 'Resuelto'
    return status
  }

  const workshopSummary = useMemo(() => {
    if (!selectedWorkshop) {
      return null
    }
    return buildWorkshopSummary(selectedWorkshop)
  }, [selectedWorkshop])

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setNewPassword('')
    setPasswordError(null)
  }

  const submitPasswordChange = async () => {
    const trimmed = newPassword.trim()
    if (trimmed.length < 6) {
      setPasswordError('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    setPasswordError(null)
    try {
      await onChangePassword(trimmed)
      closePasswordModal()
    } catch {
      // El error de backend se muestra en banner global.
    }
  }

  return (
    <Layout
      title="Dashboard"
      subtitle="Saldo tokens y acceso rapido a tus flujos"
      actions={
        <button type="button" className="landing-ghost-button" onClick={onLogout}>
          Cerrar sesion
        </button>
      }
    >
      <section className="section dashboard-hero">
        <p className="landing-chip">Workspace activo</p>
        <h2>Gestiona tu saldo y lanza workshops desde un solo lugar.</h2>
        <p className="landing-lead">Usa el helper para iniciar creaciones nuevas o retomar sesiones en curso.</p>
      </section>

      <section className="section dashboard-shell stack">
        <div className="grid">
          <InfoCard
            label="Workshop tokens"
            value={balance === null ? 'Sin datos' : `${balance.toString()} disponibles`}
          />
        </div>

        <div className="row dashboard-actions">
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            Actualizar saldo
          </button>
          <button type="button" onClick={() => void onStartHelper()} disabled={loading}>
            Iniciar helper
          </button>
          <button type="button" onClick={onGoPurchase}>
            Comprar tokens
          </button>
          <button type="button" onClick={onGoProfile}>
            Editar perfil
          </button>
          <button type="button" onClick={onGoHistory}>
            Ver historial
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPasswordModal(true)
              setPasswordError(null)
            }}
            disabled={loading}
          >
            Cambiar contrasena
          </button>
        </div>

        <article className="card stack">
          <h3>Sesiones existentes</h3>
          {helperSessions.length === 0 ? (
            <p className="hint">No tienes sesiones activas.</p>
          ) : (
            helperSessions.map((session) => (
              <div className="row" key={session.sessionId}>
                <p>
                  {session.sessionId} | estado: {session.status} | step: {session.currentStepTitle}
                </p>
                <button type="button" onClick={() => void onOpenSession(session.sessionId)} disabled={loading}>
                  Continuar
                </button>
              </div>
            ))
          )}
        </article>

        <article className="card stack">
          <h3>Casos escalados</h3>
          {escalatedCases.length === 0 ? (
            <p className="hint">No tienes casos escalados.</p>
          ) : (
            escalatedCases.map((item) => (
              <p key={item.caseId}>
                {item.caseId} | sesion: {item.sessionId} | step: {item.stepId} | estado: {statusLabel(item.attentionStatus)}
              </p>
            ))
          )}
        </article>

        <article className="card stack">
          <h3>Workshops generados</h3>
          {generatedWorkshops.length === 0 ? (
            <p className="hint">Aún no tienes workshops finalizados.</p>
          ) : (
            <div className="workshop-generated-grid">
              {generatedWorkshops.slice(0, 8).map((item) => {
                const summary = buildWorkshopSummary(item)
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="workshop-generated-card"
                    onClick={() => setSelectedWorkshop(item)}
                  >
                    <h4>{summary.title}</h4>
                    <p>{summary.description ?? 'Workshop finalizado sin descripción cargada.'}</p>
                    <div className="workshop-generated-meta">
                      <span>Sesiones: {summary.sessions ?? '-'}</span>
                      <span>Estado: {item.status ?? '-'}</span>
                      <span>ID: {item.id}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </article>

        {noticeMessage ? (
          <article className="card stack dashboard-notice-card">
            <p>{noticeMessage}</p>
            <div className="row">
              {noticePrimaryLabel && onNoticePrimary ? (
                <button type="button" onClick={() => void onNoticePrimary()} disabled={loading}>
                  {noticePrimaryLabel}
                </button>
              ) : null}
              {noticeSecondaryLabel && onNoticeSecondary ? (
                <button type="button" onClick={onNoticeSecondary} disabled={loading}>
                  {noticeSecondaryLabel}
                </button>
              ) : null}
            </div>
          </article>
        ) : null}

        <ErrorBanner message={error} />
      </section>

      {workshopSummary ? (
        <div
          className="landing-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Resumen de workshop"
          onClick={() => setSelectedWorkshop(null)}
        >
          <article className="landing-modal" onClick={(event) => event.stopPropagation()}>
            <header className="landing-modal-header">
              <h3>Resumen del workshop</h3>
              <button type="button" className="landing-ghost-button" onClick={() => setSelectedWorkshop(null)}>
                Cerrar
              </button>
            </header>
            <div className="landing-modal-body workshop-summary-modal-body">
              <p>
                <strong>{workshopSummary.title}</strong>
              </p>
              <p>{workshopSummary.description ?? 'Sin descripción disponible.'}</p>
              <div className="workshop-summary-grid">
                <p>
                  <strong>Sesiones:</strong> {workshopSummary.sessions ?? '-'}
                </p>
                <p>
                  <strong>Duración/sesión:</strong>{' '}
                  {workshopSummary.durationMinutes ? `${workshopSummary.durationMinutes} min` : '-'}
                </p>
                <p>
                  <strong>Público objetivo:</strong> {workshopSummary.targetAudience ?? '-'}
                </p>
                <p>
                  <strong>Objetivo principal:</strong> {workshopSummary.mainObjective ?? '-'}
                </p>
                <p>
                  <strong>Formato:</strong> {workshopSummary.format ?? '-'}
                </p>
                <p>
                  <strong>Entregables:</strong>{' '}
                  {workshopSummary.deliveryModes.length > 0 ? workshopSummary.deliveryModes.join(', ') : '-'}
                </p>
                <p>
                  <strong>Creado:</strong> {formatEpoch(workshopSummary.createdAtEpoch) ?? '-'}
                </p>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div
          className="landing-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Cambiar contrasena"
          onClick={closePasswordModal}
        >
          <article className="landing-modal" onClick={(event) => event.stopPropagation()}>
            <header className="landing-modal-header">
              <h3>Cambiar contrasena</h3>
              <button type="button" className="landing-ghost-button" onClick={closePasswordModal}>
                Cerrar
              </button>
            </header>
            <div className="landing-modal-body stack">
              <label>
                Nueva contrasena (min 6)
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoFocus
                />
              </label>
              <ErrorBanner message={passwordError} />
              <div className="row">
                <button type="button" onClick={() => void submitPasswordChange()} disabled={loading}>
                  Guardar
                </button>
                <button type="button" className="landing-ghost-button" onClick={closePasswordModal}>
                  Cancelar
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </Layout>
  )
}
