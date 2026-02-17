/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useApiClient } from './ApiClientContext'
import { useAuth } from './AuthContext'
import type { GenericRecord, WorkshopRecord } from '../types/backend'
import { formatBackendError } from '../utils/backendErrors'

type WorkshopsContextValue = {
  history: WorkshopRecord[]
  list: WorkshopRecord[]
  loading: boolean
  error: string | null
  loadHistory: () => Promise<void>
  loadList: () => Promise<void>
  clearError: () => void
}

const WorkshopsContext = createContext<WorkshopsContextValue | undefined>(undefined)

function asRecord(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function asWorkshops(payload: unknown): WorkshopRecord[] {
  const source = Array.isArray(payload) ? payload : []

  return source
    .map((item, index) => {
      const row = asRecord(item)
      const idCandidate = row.workshopId ?? row.jobId ?? row.id
      const id = typeof idCandidate === 'string' ? idCandidate : `row-${index}`
      const titleCandidate = row.workshopName ?? row.title ?? row.workshop_nombre ?? row.name

      return {
        id,
        title: typeof titleCandidate === 'string' ? titleCandidate : 'Workshop sin titulo',
        status: typeof row.status === 'string' ? row.status : undefined,
        createdAtEpoch:
          typeof row.createdAtEpoch === 'number' ? row.createdAtEpoch : undefined,
        updatedAtEpoch:
          typeof row.updatedAtEpoch === 'number'
            ? row.updatedAtEpoch
            : typeof row.createdAtEpoch === 'number'
              ? row.createdAtEpoch
              : undefined,
        raw: row,
      }
    })
    .filter((item) => item.id.length > 0)
}

export function WorkshopsProvider({ children }: PropsWithChildren) {
  const { request } = useApiClient()
  const { idToken } = useAuth()

  const [history, setHistory] = useState<WorkshopRecord[]>([])
  const [list, setList] = useState<WorkshopRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withToken = useCallback(() => {
    if (!idToken) {
      throw new Error('Sesion no autenticada')
    }
    return idToken
  }, [idToken])

  const clearError = useCallback(() => setError(null), [])

  const loadHistory = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshops/history', {
        method: 'POST',
        body: { idToken: token },
      })
      setHistory(asWorkshops(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar historial de workshops')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const loadList = useCallback(async () => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/users/workshops/list', {
        method: 'POST',
        body: { idToken: token },
      })
      setList(asWorkshops(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar listado de workshops')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const value = useMemo<WorkshopsContextValue>(
    () => ({
      history,
      list,
      loading,
      error,
      loadHistory,
      loadList,
      clearError,
    }),
    [clearError, error, history, list, loadHistory, loadList, loading],
  )

  return <WorkshopsContext.Provider value={value}>{children}</WorkshopsContext.Provider>
}

export function useWorkshops() {
  const ctx = useContext(WorkshopsContext)
  if (!ctx) {
    throw new Error('useWorkshops must be used within WorkshopsProvider')
  }
  return ctx
}
