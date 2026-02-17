import { Layout, ErrorBanner, InfoCard } from './Layout'

type Props = {
  balance: number | null
  loading: boolean
  error: string | null
  noticeMessage?: string | null
  noticePrimaryLabel?: string | null
  noticeSecondaryLabel?: string | null
  onRefresh: () => Promise<void>
  onStartHelper: () => Promise<void>
  onNoticePrimary?: () => Promise<void> | void
  onNoticeSecondary?: () => void
  onGoPurchase: () => void
  onGoProfile: () => void
  onGoHistory: () => void
  onChangePassword: () => Promise<void>
  onLogout: () => void
}

export function DashboardScreen({
  balance,
  loading,
  error,
  noticeMessage,
  noticePrimaryLabel,
  noticeSecondaryLabel,
  onRefresh,
  onStartHelper,
  onNoticePrimary,
  onNoticeSecondary,
  onGoPurchase,
  onGoProfile,
  onGoHistory,
  onChangePassword,
  onLogout,
}: Props) {
  return (
    <Layout
      title="Dashboard"
      subtitle="Saldo tokens y acceso a flujos"
      actions={
        <button type="button" onClick={onLogout}>
          Cerrar sesion
        </button>
      }
    >
      <section className="section">
        <div className="grid">
          <InfoCard
            label="Workshop tokens"
            value={balance === null ? 'Sin datos' : `${balance.toString()} disponibles`}
          />
        </div>

        <div className="row">
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
          <button type="button" onClick={() => void onChangePassword()} disabled={loading}>
            Cambiar contrasena
          </button>
        </div>

        {noticeMessage ? (
          <article className="card stack">
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
    </Layout>
  )
}
