import { Layout, ErrorBanner } from './Layout'
import type { WorkshopRecord } from '../types/backend'

type Props = {
  history: WorkshopRecord[]
  loading: boolean
  error: string | null
  onBack: () => void
  onRefresh: () => Promise<void>
  onSelect: (workshop: WorkshopRecord) => void
}

export function WorkshopHistoryScreen({ history, loading, error, onBack, onRefresh, onSelect }: Props) {
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
        <div className="row">
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar historial'}
          </button>
        </div>

        <div className="stack">
          {history.map((item) => (
            <article className="card" key={item.id}>
              <h3>{item.title}</h3>
              <p>ID: {item.id}</p>
              <p>Estado: {item.status ?? '-'}</p>
              <p>Actualizado epoch: {item.updatedAtEpoch ?? '-'}</p>
              <button type="button" onClick={() => onSelect(item)}>
                Ver detalle
              </button>
            </article>
          ))}
          {history.length === 0 ? <p className="hint">No hay workshops en historial.</p> : null}
        </div>

        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
