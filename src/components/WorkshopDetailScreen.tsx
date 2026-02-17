import { Layout } from './Layout'
import type { WorkshopRecord } from '../types/backend'

type Props = {
  workshop: WorkshopRecord
  onBack: () => void
}

export function WorkshopDetailScreen({ workshop, onBack }: Props) {
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
        <p>ID: {workshop.id}</p>
        <p>Estado: {workshop.status ?? '-'}</p>
        <p>Creado epoch: {workshop.createdAtEpoch ?? '-'}</p>
        <p>Actualizado epoch: {workshop.updatedAtEpoch ?? '-'}</p>
        <pre>{JSON.stringify(workshop.raw, null, 2)}</pre>
      </section>
    </Layout>
  )
}
