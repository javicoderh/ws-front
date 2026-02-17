import { useState } from 'react'
import { Layout, ErrorBanner } from './Layout'
import type { StartCheckoutResult, TokenPack } from '../types/backend'

type Props = {
  packs: TokenPack[]
  unitPriceClp: number | null
  unitPriceUsd: number | null
  loading: boolean
  error: string | null
  onBack: () => void
  onLoadPacks: () => Promise<void>
  onLoadPricing: () => Promise<void>
  onLoadHistory: () => Promise<void>
  onLoadPurchaseHistory: () => Promise<void>
  onStartCheckout: (packId: string) => Promise<StartCheckoutResult>
  onConfirmCheckout: () => Promise<void>
}

export function TokenPurchaseScreen({
  packs,
  unitPriceClp,
  unitPriceUsd,
  loading,
  error,
  onBack,
  onLoadPacks,
  onLoadPricing,
  onLoadHistory,
  onLoadPurchaseHistory,
  onStartCheckout,
  onConfirmCheckout,
}: Props) {
  const [checkoutFeedback, setCheckoutFeedback] = useState<string | null>(null)

  return (
    <Layout
      title="Compra de tokens"
      subtitle="Flujo Mercado Pago: packs -> start -> redirect -> confirm"
      actions={
        <button type="button" onClick={onBack}>
          Volver
        </button>
      }
    >
      <section className="section stack">
        <div className="row">
          <button type="button" onClick={() => void onLoadPricing()} disabled={loading}>
            Cargar pricing
          </button>
          <button type="button" onClick={() => void onLoadPacks()} disabled={loading}>
            Cargar packs
          </button>
          <button type="button" onClick={() => void onLoadHistory()} disabled={loading}>
            Historial tokens
          </button>
          <button type="button" onClick={() => void onLoadPurchaseHistory()} disabled={loading}>
            Historial compras
          </button>
        </div>

        <p className="hint">
          Precio unitario: {unitPriceClp ?? '-'} CLP / {unitPriceUsd ?? '-'} USD
        </p>

        <div className="grid">
          {packs.map((pack) => (
            <article className="card" key={pack.packId}>
              <h3>{pack.label}</h3>
              <p>{pack.tokens} tokens</p>
              <small>{pack.priceClp} CLP</small>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void onStartCheckout(pack.packId).then((result) => {
                    if (result.checkoutUrl) {
                      window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
                    }
                    setCheckoutFeedback(
                      result.paymentSession?.paymentSessionId
                        ? `Checkout iniciado. Sesion: ${result.paymentSession.paymentSessionId}`
                        : 'Checkout iniciado. Vuelve y presiona confirmar.',
                    )
                  })
                }}
              >
                Iniciar checkout
              </button>
            </article>
          ))}
        </div>

        <div className="row">
          <button type="button" disabled={loading} onClick={() => void onConfirmCheckout()}>
            Confirmar checkout
          </button>
        </div>

        {checkoutFeedback ? <p className="hint">{checkoutFeedback}</p> : null}
        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
