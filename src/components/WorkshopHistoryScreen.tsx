import { useMemo } from 'react'
import { Layout, ErrorBanner } from './Layout'
import type { WorkshopRecord } from '../types/backend'
import { buildWorkshopSummary, formatEpoch } from '../utils/workshopSummary'

type Props = {
  history: WorkshopRecord[]
  loading: boolean
  error: string | null
  onBack: () => void
  onRefresh: () => Promise<void>
  onSelect: (workshop: WorkshopRecord) => void
  onOpenGeneration: (workshop: WorkshopRecord) => Promise<void>
  onGenerateNewVersion: (workshop: WorkshopRecord) => Promise<void>
}

export function WorkshopHistoryScreen({
  history,
  loading,
  error,
  onBack,
  onRefresh,
  onSelect,
  onOpenGeneration,
  onGenerateNewVersion,
}: Props) {
  const items = useMemo(() => {
    const byKey = new Map<string, WorkshopRecord>()

    for (const item of history) {
      const workshopId = typeof item.raw.workshopId === 'string' ? item.raw.workshopId : ''
      const key = workshopId || item.id
      const currentEpoch = item.updatedAtEpoch ?? item.createdAtEpoch ?? 0
      const previous = byKey.get(key)
      const previousEpoch = previous ? (previous.updatedAtEpoch ?? previous.createdAtEpoch ?? 0) : -1

      if (!previous || currentEpoch >= previousEpoch) {
        byKey.set(key, item)
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aEpoch = a.updatedAtEpoch ?? a.createdAtEpoch ?? 0
      const bEpoch = b.updatedAtEpoch ?? b.createdAtEpoch ?? 0
      return bEpoch - aEpoch
    })
  }, [history])

  const doneBySession = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      const status = (item.status ?? '').toLowerCase()
      if (status !== 'done' && status !== 'completed' && status !== 'finished') {
        continue
      }
      const helperSessionId = getHelperSessionId(item)
      if (helperSessionId) {
        set.add(helperSessionId)
      }
    }
    return set
  }, [items])

  return (
    <Layout
      title="Historial workshops"
      subtitle="Fuente users/workshops/history"
      actions={
        <button type="button" onClick={onBack}>
          Volver
        </button>
      }
    >
      <section className="section stack">
        <article className="card stack history-ux-note">
          <p>
            Reintentar un caso <strong>fallido</strong> no consume token.
          </p>
          <p>
            Generar una <strong>nueva versión</strong> sí consume <strong>1 token</strong>.
          </p>
        </article>

        <div className="row">
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar historial'}
          </button>
        </div>

        <div className="stack">
          {items.map((item) => {
            const summary = buildWorkshopSummary(item)
            const status = (item.status ?? '-').toLowerCase()
            const helperSessionId = getHelperSessionId(item)
            const hasSucceededSibling = helperSessionId ? doneBySession.has(helperSessionId) : false
            const canRetryFailed = status === 'failed' && !hasSucceededSibling
            const canGenerateVersion = status === 'done' || status === 'completed' || status === 'finished'
            return (
              <article className="card workshop-history-card" key={item.id}>
                <div className="row workshop-history-head">
                  <h3>{summary.title}</h3>
                  <span className={`status-pill status-${status}`}>{statusLabel(item.status)}</span>
                </div>
                <p className="hint">{summary.description ?? 'Sin descripción resumida disponible.'}</p>
                <div className="workshop-history-meta">
                  <p>
                    <strong>Sesiones:</strong> {summary.sessions ?? '-'}
                  </p>
                  <p>
                    <strong>Duración:</strong> {summary.durationMinutes ? `${summary.durationMinutes} min` : '-'}
                  </p>
                  <p>
                    <strong>Objetivo:</strong> {summary.mainObjective ?? '-'}
                  </p>
                  <p>
                    <strong>Última actualización:</strong> {formatEpoch(item.updatedAtEpoch ?? item.createdAtEpoch) ?? '-'}
                  </p>
                  <p>
                    <strong>ID:</strong> {item.id}
                  </p>
                </div>
                <div className="row">
                  <button type="button" onClick={() => onSelect(item)}>
                    Ver detalle
                  </button>
                  {canRetryFailed ? (
                    <button type="button" onClick={() => void onOpenGeneration(item)} disabled={loading}>
                      Reintentar en generación
                    </button>
                  ) : null}
                  {status === 'failed' && hasSucceededSibling ? (
                    <p className="hint">Este fallo ya quedó resuelto por una generación exitosa.</p>
                  ) : null}
                  {canGenerateVersion ? (
                    <button
                      type="button"
                      className="danger-soft-button"
                      onClick={() => void onGenerateNewVersion(item)}
                      disabled={loading}
                    >
                      Generar nueva versión (1 token)
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
          {items.length === 0 ? <p className="hint">No hay workshops en historial.</p> : null}
        </div>

        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}

function statusLabel(status?: string) {
  const value = (status ?? '').toLowerCase()
  if (value === 'done' || value === 'completed' || value === 'finished') {
    return 'Finalizado'
  }
  if (value === 'failed') {
    return 'Fallido'
  }
  if (value === 'running' || value === 'queued') {
    return 'En proceso'
  }
  return status ?? '-'
}

function getHelperSessionId(item: WorkshopRecord): string | null {
  const raw = item.raw as Record<string, unknown>
  const direct = typeof raw.helperSessionId === 'string' ? raw.helperSessionId : ''
  if (direct.trim()) {
    return direct.trim()
  }
  const snake = typeof raw.helper_session_id === 'string' ? raw.helper_session_id : ''
  if (snake.trim()) {
    return snake.trim()
  }
  return null
}
