/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useApiClient } from './ApiClientContext'
import { useAuth } from './AuthContext'
import type {
  ConfirmCheckoutResult,
  GenericRecord,
  StartCheckoutResult,
  TokenPack,
  TokenPurchaseHistory,
  WorkshopTokenPricing,
  WorkshopTokenTransaction,
} from '../types/backend'
import { formatBackendError } from '../utils/backendErrors'

type TokensContextValue = {
  balance: number | null
  pricing: WorkshopTokenPricing | null
  packs: TokenPack[]
  ledger: WorkshopTokenTransaction[]
  history: WorkshopTokenTransaction[]
  purchaseHistory: TokenPurchaseHistory | null
  lastCheckout: StartCheckoutResult | null
  loading: boolean
  error: string | null
  refreshBalance: () => Promise<void>
  loadPricing: () => Promise<void>
  loadTokenPacks: () => Promise<void>
  loadLedger: () => Promise<void>
  loadHistory: () => Promise<void>
  loadPurchaseHistory: () => Promise<void>
  startCheckout: (packId: string) => Promise<StartCheckoutResult>
  confirmCheckout: (paymentSessionId?: string) => Promise<ConfirmCheckoutResult>
  clearError: () => void
}

const TokensContext = createContext<TokensContextValue | undefined>(undefined)

function toRecord(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function parseBalance(payload: unknown): number | null {
  if (Array.isArray(payload)) {
    const txs = parseTransactions(payload)
    if (txs.length > 0) {
      return txs[0].balanceAfterTokens
    }
  }

  const record = toRecord(payload)
  const candidates = [record.workshopTokensBalance, record.workshop_tokens_balance, record.balance]
  for (const candidate of candidates) {
    if (typeof candidate === 'number') {
      return candidate
    }
  }

  return null
}

function parseTokenPack(row: unknown): TokenPack | null {
  const item = toRecord(row)
  const packId = item.packId
  if (typeof packId !== 'string' || !packId) {
    return null
  }
  return {
    packId,
    tokens: typeof item.tokens === 'number' ? item.tokens : Number(item.tokens ?? 0),
    priceClp: typeof item.priceClp === 'number' ? item.priceClp : Number(item.priceClp ?? 0),
    label: typeof item.label === 'string' ? item.label : packId,
  }
}

function parsePacks(payload: unknown): TokenPack[] {
  const source = Array.isArray(payload) ? payload : []
  return source.map(parseTokenPack).filter((pack): pack is TokenPack => pack !== null)
}

function parseTransaction(item: unknown): WorkshopTokenTransaction | null {
  const row = toRecord(item)
  if (typeof row.transactionId !== 'string' || typeof row.uid !== 'string') {
    return null
  }
  return {
    transactionId: row.transactionId,
    uid: row.uid,
    tokens: typeof row.tokens === 'number' ? row.tokens : Number(row.tokens ?? 0),
    movementType: typeof row.movementType === 'string' ? row.movementType : undefined,
    source: typeof row.source === 'string' ? row.source : '-',
    referenceId: typeof row.referenceId === 'string' ? row.referenceId : '-',
    idempotencyKey: typeof row.idempotencyKey === 'string' ? row.idempotencyKey : '-',
    unitPriceUsd: typeof row.unitPriceUsd === 'number' ? row.unitPriceUsd : 0,
    unitPriceClp: typeof row.unitPriceClp === 'number' ? row.unitPriceClp : 0,
    amountPaidUsd: typeof row.amountPaidUsd === 'number' ? row.amountPaidUsd : 0,
    amountPaidClp: typeof row.amountPaidClp === 'number' ? row.amountPaidClp : 0,
    balanceAfterTokens: typeof row.balanceAfterTokens === 'number' ? row.balanceAfterTokens : 0,
    createdAtEpoch: typeof row.createdAtEpoch === 'number' ? row.createdAtEpoch : 0,
  }
}

function parseTransactions(payload: unknown): WorkshopTokenTransaction[] {
  if (!Array.isArray(payload)) {
    return []
  }
  return payload.map(parseTransaction).filter((tx): tx is WorkshopTokenTransaction => tx !== null)
}

function parsePurchaseHistory(payload: unknown): TokenPurchaseHistory | null {
  const row = toRecord(payload)
  if (!Array.isArray(row.purchases)) {
    return null
  }
  return {
    purchases: row.purchases
      .map((purchase): TokenPurchaseHistory['purchases'][number] | null => {
        const item = toRecord(purchase)
        if (typeof item.purchaseId !== 'string' || typeof item.uid !== 'string') {
          return null
        }
        return {
          purchaseId: item.purchaseId,
          uid: item.uid,
          provider: typeof item.provider === 'string' ? item.provider : '-',
          providerPaymentId:
            typeof item.providerPaymentId === 'string' ? item.providerPaymentId : '-',
          paymentSessionId: typeof item.paymentSessionId === 'string' ? item.paymentSessionId : '-',
          packId: typeof item.packId === 'string' ? item.packId : '-',
          tokens: typeof item.tokens === 'number' ? item.tokens : 0,
          amountClp: typeof item.amountClp === 'number' ? item.amountClp : 0,
          currency: typeof item.currency === 'string' ? item.currency : '-',
          status: typeof item.status === 'string' ? item.status : '-',
          createdAtEpoch: typeof item.createdAtEpoch === 'number' ? item.createdAtEpoch : 0,
        }
      })
      .filter((item): item is TokenPurchaseHistory['purchases'][number] => item !== null),
    totalPurchases: typeof row.totalPurchases === 'number' ? row.totalPurchases : 0,
    totalTokensPurchased:
      typeof row.totalTokensPurchased === 'number' ? row.totalTokensPurchased : 0,
    totalAmountClp: typeof row.totalAmountClp === 'number' ? row.totalAmountClp : 0,
  }
}

export function TokensProvider({ children }: PropsWithChildren) {
  const { request } = useApiClient()
  const { idToken } = useAuth()
  const [balance, setBalance] = useState<number | null>(null)
  const [pricing, setPricing] = useState<WorkshopTokenPricing | null>(null)
  const [packs, setPacks] = useState<TokenPack[]>([])
  const [ledger, setLedger] = useState<WorkshopTokenTransaction[]>([])
  const [history, setHistory] = useState<WorkshopTokenTransaction[]>([])
  const [purchaseHistory, setPurchaseHistory] = useState<TokenPurchaseHistory | null>(null)
  const [lastCheckout, setLastCheckout] = useState<StartCheckoutResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const withToken = useCallback(() => {
    if (!idToken) {
      throw new Error('Sesion no autenticada')
    }
    return idToken
  }, [idToken])

  const refreshBalance = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const ledger = await request<unknown>('/users/workshop-tokens/ledger', {
        method: 'POST',
        body: { idToken: token },
      })

      setLedger(parseTransactions(ledger))
      const parsed = parseBalance(ledger)
      if (parsed !== null) {
        setBalance(parsed)
        return
      }

      const profile = await request<unknown>('/users/profile/get', {
        method: 'POST',
        body: { idToken: token },
      })
      setBalance(parseBalance(profile))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar saldo de tokens')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const loadPricing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshop-tokens/pricing')
      const row = toRecord(payload)
      setPricing({
        unitPriceUsd: typeof row.unitPriceUsd === 'number' ? row.unitPriceUsd : 0,
        unitPriceClp: typeof row.unitPriceClp === 'number' ? row.unitPriceClp : 0,
      })
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar pricing de tokens')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request])

  const loadTokenPacks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await request<unknown>('/payments/token-packs')
      setPacks(parsePacks(data))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudieron cargar los packs')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request])

  const loadLedger = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshop-tokens/ledger', {
        method: 'POST',
        body: { idToken: token },
      })
      const parsed = parseTransactions(payload)
      setLedger(parsed)
      if (parsed.length > 0) {
        setBalance(parsed[0].balanceAfterTokens)
      }
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar ledger de tokens')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const loadHistory = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshop-tokens/history', {
        method: 'POST',
        body: { idToken: token },
      })
      const row = toRecord(payload)
      const parsed = parseTransactions(row.all)
      setHistory(parsed)
      if (parsed.length > 0) {
        setBalance(parsed[0].balanceAfterTokens)
      }
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar historial de tokens')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const loadPurchaseHistory = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshop-tokens/purchases/history', {
        method: 'POST',
        body: { idToken: token },
      })
      setPurchaseHistory(parsePurchaseHistory(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar historial de compras')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const startCheckout = useCallback(
    async (packId: string): Promise<StartCheckoutResult> => {
      const token = withToken()
      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/payments/checkout/start', {
          method: 'POST',
          body: { idToken: token, packId },
        })
        const row = toRecord(payload)
        const paymentSession = toRecord(row.paymentSession)
        const parsed: StartCheckoutResult = {
          paymentSession: {
            paymentSessionId:
              typeof paymentSession.paymentSessionId === 'string'
                ? paymentSession.paymentSessionId
                : '',
            uid: typeof paymentSession.uid === 'string' ? paymentSession.uid : '',
            packId: typeof paymentSession.packId === 'string' ? paymentSession.packId : '',
            tokens: typeof paymentSession.tokens === 'number' ? paymentSession.tokens : 0,
            amountClp: typeof paymentSession.amountClp === 'number' ? paymentSession.amountClp : 0,
            checkoutUrl:
              typeof paymentSession.checkoutUrl === 'string' ? paymentSession.checkoutUrl : undefined,
            providerPreferenceId:
              typeof paymentSession.providerPreferenceId === 'string'
                ? paymentSession.providerPreferenceId
                : undefined,
            providerPaymentId:
              typeof paymentSession.providerPaymentId === 'string'
                ? paymentSession.providerPaymentId
                : undefined,
            status: typeof paymentSession.status === 'string' ? paymentSession.status : 'pending',
            createdAtEpoch:
              typeof paymentSession.createdAtEpoch === 'number' ? paymentSession.createdAtEpoch : 0,
            updatedAtEpoch:
              typeof paymentSession.updatedAtEpoch === 'number' ? paymentSession.updatedAtEpoch : 0,
          },
          packs: parsePacks(row.packs),
          checkoutUrl: typeof row.checkoutUrl === 'string' ? row.checkoutUrl : '',
        }
        setLastCheckout(parsed)
        setPacks(parsed.packs)
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo iniciar checkout')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, withToken],
  )

  const confirmCheckout = useCallback(
    async (paymentSessionId?: string): Promise<ConfirmCheckoutResult> => {
      const token = withToken()
      setLoading(true)
      setError(null)
      try {
        const sessionId = typeof paymentSessionId === 'string' ? paymentSessionId.trim() : ''
        const payload = await request<unknown>('/payments/checkout/confirm', {
          method: 'POST',
          body: sessionId ? { idToken: token, paymentSessionId: sessionId } : { idToken: token },
        })
        const row = toRecord(payload)
        const session = toRecord(row.paymentSession)
        const result: ConfirmCheckoutResult = {
          paymentSession: {
            paymentSessionId:
              typeof session.paymentSessionId === 'string' ? session.paymentSessionId : '',
            uid: typeof session.uid === 'string' ? session.uid : '',
            packId: typeof session.packId === 'string' ? session.packId : '',
            tokens: typeof session.tokens === 'number' ? session.tokens : 0,
            amountClp: typeof session.amountClp === 'number' ? session.amountClp : 0,
            checkoutUrl: typeof session.checkoutUrl === 'string' ? session.checkoutUrl : undefined,
            providerPreferenceId:
              typeof session.providerPreferenceId === 'string'
                ? session.providerPreferenceId
                : undefined,
            providerPaymentId:
              typeof session.providerPaymentId === 'string' ? session.providerPaymentId : undefined,
            status: typeof session.status === 'string' ? session.status : 'pending',
            createdAtEpoch: typeof session.createdAtEpoch === 'number' ? session.createdAtEpoch : 0,
            updatedAtEpoch: typeof session.updatedAtEpoch === 'number' ? session.updatedAtEpoch : 0,
          },
          workshopTokensBalance:
            typeof row.workshopTokensBalance === 'number' ? row.workshopTokensBalance : 0,
        }
        setBalance(result.workshopTokensBalance)
        return result
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo confirmar el pago')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, withToken],
  )

  const value = useMemo<TokensContextValue>(
    () => ({
      balance,
      pricing,
      packs,
      ledger,
      history,
      purchaseHistory,
      lastCheckout,
      loading,
      error,
      refreshBalance,
      loadPricing,
      loadTokenPacks,
      loadLedger,
      loadHistory,
      loadPurchaseHistory,
      startCheckout,
      confirmCheckout,
      clearError,
    }),
    [
      balance,
      clearError,
      confirmCheckout,
      error,
      history,
      lastCheckout,
      ledger,
      loadHistory,
      loadLedger,
      loadPricing,
      loadPurchaseHistory,
      loadTokenPacks,
      loading,
      packs,
      pricing,
      purchaseHistory,
      refreshBalance,
      startCheckout,
    ],
  )

  return <TokensContext.Provider value={value}>{children}</TokensContext.Provider>
}

export function useTokens() {
  const ctx = useContext(TokensContext)
  if (!ctx) {
    throw new Error('useTokens must be used within TokensProvider')
  }
  return ctx
}
