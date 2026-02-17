import { Layout, ErrorBanner, InfoCard } from './Layout'
import type { JobStatus, QueueStatus } from '../types/backend'

type Props = {
  jobId: string | null
  jobStatus: JobStatus | null
  queueStatus: QueueStatus | null
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  onBackDashboard: () => void
  onGoHistory: () => void
}

function renderAhead(label: string, jobs?: { jobId: string; workshopName: string }[]) {
  if (!jobs || jobs.length === 0) {
    return <p className="hint">{label}: sin datos.</p>
  }

  return (
    <article className="card">
      <h3>{label}</h3>
      {jobs.map((job) => (
        <p key={job.jobId}>
          {job.workshopName} ({job.jobId})
        </p>
      ))}
    </article>
  )
}

export function GenerationStatusScreen({
  jobId,
  jobStatus,
  queueStatus,
  loading,
  error,
  onRefresh,
  onBackDashboard,
  onGoHistory,
}: Props) {
  const status = jobStatus?.job.status ?? 'unknown'
  const finished = status === 'done' || status === 'completed' || status === 'failed' || status === 'cancelled'

  return (
    <Layout
      title="Estado de generacion"
      subtitle="Polling de job y cola cada 3s"
      actions={
        <div className="row">
          <button type="button" onClick={onBackDashboard}>
            Dashboard
          </button>
          <button type="button" onClick={onGoHistory}>
            Historial
          </button>
        </div>
      }
    >
      <section className="section stack">
        <div className="grid">
          <InfoCard label="Job ID" value={jobId ?? 'No disponible'} />
          <InfoCard label="Estado job" value={status} />
          <InfoCard
            label="Posicion cola"
            value={`${jobStatus?.queuePosition ?? '-'} `}
          />
          <InfoCard
            label="ETA (min)"
            value={`${jobStatus?.etaMinutes ?? '-'} `}
          />
          <InfoCard
            label="Running / Max"
            value={`${jobStatus?.runningCount ?? queueStatus?.runningCount ?? 0} / ${jobStatus?.maxParallel ?? queueStatus?.maxParallel ?? 1}`}
          />
          <InfoCard
            label="En cola global"
            value={`${queueStatus?.queuedCount ?? 0}`}
          />
        </div>

        {renderAhead('Trabajos por delante (job)', jobStatus?.jobsAhead)}

        {queueStatus?.waitingQueue.length ? (
          <article className="card">
            <h3>Cola global</h3>
            {queueStatus.waitingQueue.slice(0, 8).map((job) => (
              <p key={job.jobId}>
                {job.workshopName} ({job.status})
              </p>
            ))}
          </article>
        ) : null}

        <div className="row">
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar ahora'}
          </button>
        </div>

        {finished ? <p className="pill">Proceso finalizado: {status}</p> : null}
        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
