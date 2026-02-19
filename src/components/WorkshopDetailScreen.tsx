import { useMemo, useState } from 'react'
import { Layout } from './Layout'
import type { WorkshopRecord } from '../types/backend'
import { explainJobFailure } from '../utils/jobErrors'
import { buildWorkshopSummary, formatEpoch } from '../utils/workshopSummary'

type Props = {
  workshop: WorkshopRecord
  onBack: () => void
}

export function WorkshopDetailScreen({ workshop, onBack }: Props) {
  const [showRaw, setShowRaw] = useState(false)
  const technicalError =
    typeof workshop.raw.error === 'string'
      ? workshop.raw.error
      : typeof workshop.raw.jobError === 'string'
        ? workshop.raw.jobError
        : undefined
  const failure = explainJobFailure(technicalError)
  const summary = useMemo(() => buildWorkshopSummary(workshop), [workshop])

  return (
    <Layout
      title="Detalle workshop"
      subtitle={workshop.title}
      actions={
        <button type="button" onClick={onBack}>
          Volver
        </button>
      }
    >
      <section className="section stack">
        <article className="card stack">
          <h3>{summary.title}</h3>
          <p>{summary.description ?? 'Sin descripción disponible.'}</p>
          <div className="workshop-history-meta">
            <p>
              <strong>ID:</strong> {workshop.id}
            </p>
            <p>
              <strong>Estado:</strong> {workshop.status ?? '-'}
            </p>
            <p>
              <strong>Sesiones:</strong> {summary.sessions ?? '-'}
            </p>
            <p>
              <strong>Duración/sesión:</strong>{' '}
              {summary.durationMinutes ? `${summary.durationMinutes} min` : '-'}
            </p>
            <p>
              <strong>Público objetivo:</strong> {summary.targetAudience ?? '-'}
            </p>
            <p>
              <strong>Objetivo principal:</strong> {summary.mainObjective ?? '-'}
            </p>
            <p>
              <strong>Formato:</strong> {summary.format ?? '-'}
            </p>
            <p>
              <strong>Entregables:</strong> {summary.deliveryModes.length > 0 ? summary.deliveryModes.join(', ') : '-'}
            </p>
            <p>
              <strong>Creado:</strong> {formatEpoch(workshop.createdAtEpoch) ?? '-'}
            </p>
            <p>
              <strong>Actualizado:</strong> {formatEpoch(workshop.updatedAtEpoch) ?? '-'}
            </p>
          </div>
        </article>

        {failure ? (
          <article className="card stack">
            <h3>{failure.title}</h3>
            <p>{failure.detail}</p>
            <p className="hint">Qué hacer: {failure.action}</p>
            {technicalError ? <p className="hint">Detalle técnico: {technicalError}</p> : null}
          </article>
        ) : null}

        <article className="card stack">
          <div className="row">
            <button type="button" onClick={() => setShowRaw((current) => !current)}>
              {showRaw ? 'Ocultar JSON técnico' : 'Ver JSON técnico'}
            </button>
          </div>
          {showRaw ? <pre>{JSON.stringify(workshop.raw, null, 2)}</pre> : null}
        </article>
      </section>
    </Layout>
  )
}
