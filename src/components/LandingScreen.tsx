import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type ModalKey = 'tokens' | 'creation' | 'generation' | 'tips'

type Props = {
  loading: boolean
  isAuthenticated: boolean
  onStartCreation: () => Promise<void> | void
  onGoAuth: () => void
}

function InfoModal({
  title,
  body,
  onClose,
}: {
  title: string
  body: ReactNode
  onClose: () => void
}) {
  return (
    <div className="landing-modal-backdrop" role="dialog" aria-modal="true">
      <article className="landing-modal">
        <header className="landing-modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="landing-modal-body">{body}</div>
      </article>
    </div>
  )
}

export function LandingScreen({ loading, isAuthenticated, onStartCreation, onGoAuth }: Props) {
  const [activeModal, setActiveModal] = useState<ModalKey | null>(null)

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <Link to="/" className="layout-logo-link" aria-label="Ir al inicio"><span className="layout-logo-dot" /><span>Workshopia</span></Link>
        <button type="button" className="landing-ghost-button" onClick={onGoAuth}>
          {isAuthenticated ? 'Ir al panel' : 'Iniciar sesion'}
        </button>
      </header>

      <section className="landing-hero">
        <p className="landing-chip">Plataforma de diseno asistido para talleres</p>
        <h1>Disena workshops de alto nivel en minutos, no en dias.</h1>
        <p className="landing-lead">
          Workshopia combina guiado paso a paso, validaciones inteligentes y generacion automatica
          de entregables para acelerar la creacion de workshops consistentes.
        </p>
        <div className="landing-cta-row">
          <button type="button" className="landing-primary-button" onClick={() => void onStartCreation()}>
            {loading ? 'Preparando...' : 'Empezar creacion de workshop'}
          </button>
          {!isAuthenticated ? (
            <button type="button" className="landing-ghost-button" onClick={onGoAuth}>
              Entrar con mi cuenta
            </button>
          ) : null}
        </div>
      </section>

      <section className="landing-info-grid">
        <button type="button" className="landing-glass-card" onClick={() => setActiveModal('tokens')}>
          <h2>Sistema de tokens</h2>
          <p>Como se consumen, cuando se recargan y como controlar saldo.</p>
        </button>
        <button type="button" className="landing-glass-card" onClick={() => setActiveModal('creation')}>
          <h2>Creacion de workshops</h2>
          <p>El paso a paso del helper para llevar una idea a un taller ejecutable.</p>
        </button>
        <button type="button" className="landing-glass-card" onClick={() => setActiveModal('generation')}>
          <h2>Que incluye la generacion</h2>
          <p>Plan, sesiones, instrumentos, rubricas y salida final lista para usar.</p>
        </button>
        <button type="button" className="landing-glass-card" onClick={() => setActiveModal('tips')}>
          <h2>Tips para mejores resultados</h2>
          <p>Buenas practicas para prompts, objetivos y datos de contexto.</p>
        </button>
      </section>

      {activeModal === 'tokens' ? (
        <InfoModal title="Sistema de tokens" onClose={() => setActiveModal(null)} body={
          <>
            <p>1 workshop generado consume 1 token al iniciar el helper.</p>
            <p>Las recargas quedan registradas en historial y compras.</p>
            <p>Si no hay saldo, puedes comprar tokens y luego continuar tu sesion.</p>
          </>
        } />
      ) : null}

      {activeModal === 'creation' ? (
        <InfoModal title="Creacion de workshops" onClose={() => setActiveModal(null)} body={
          <>
            <p>El helper te guia por objetivos, audiencia, sesiones, evaluaciones y formato final.</p>
            <p>Puedes editar pasos antes de generar para refinar calidad y coherencia.</p>
            <p>El proceso mantiene trazabilidad del estado y de cada decision importante.</p>
          </>
        } />
      ) : null}

      {activeModal === 'generation' ? (
        <InfoModal title="Que incluye la generacion" onClose={() => setActiveModal(null)} body={
          <>
            <p>Entrega estructura completa del workshop y materiales asociados.</p>
            <p>Incluye fases de sesion, criterios de evaluacion y piezas para exportacion.</p>
            <p>Monitorea estado en cola y progreso de construccion en tiempo real.</p>
          </>
        } />
      ) : null}

      {activeModal === 'tips' ? (
        <InfoModal title="Tips para crear mejores workshops" onClose={() => setActiveModal(null)} body={
          <>
            <p>Define objetivo principal medible y resultados esperados concretos.</p>
            <p>Especifica publico, nivel y restricciones de contexto desde el inicio.</p>
            <p>Detalla instrumentos de evaluacion cuando necesites mayor control pedagogico.</p>
          </>
        } />
      ) : null}
    </div>
  )
}
