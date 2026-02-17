/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import type { ApiError, GenericRecord } from '../types/backend'

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: GenericRecord
  signal?: AbortSignal
}

type ApiClientContextValue = {
  baseUrl: string
  request: <T>(path: string, options?: RequestOptions) => Promise<T>
}

const ApiClientContext = createContext<ApiClientContextValue | undefined>(undefined)

function toApiError(status: number, payload: unknown): ApiError {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as GenericRecord
    const message = typeof record.message === 'string' ? record.message : `HTTP ${status}`
    const code = typeof record.code === 'string' ? record.code : undefined
    return { status, message, code }
  }

  return { status, message: `HTTP ${status}` }
}

function toErrorObject(apiError: ApiError): Error {
  const error = new Error(apiError.message)
  Object.assign(error, apiError)
  return error
}

export function ApiClientProvider({ children }: PropsWithChildren) {
  const value = useMemo<ApiClientContextValue>(() => {
    const baseUrl = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:3000'

    const request = async <T,>(path: string, options?: RequestOptions): Promise<T> => {
      const method = options?.method ?? 'GET'
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: options?.signal,
      })

      const text = await response.text()
      let payload: unknown = null
      if (text) {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { message: text }
        }
      }

      if (!response.ok) {
        throw toErrorObject(toApiError(response.status, payload))
      }

      return payload as T
    }

    return {
      baseUrl,
      request,
    }
  }, [])

  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>
}

export function useApiClient() {
  const ctx = useContext(ApiClientContext)
  if (!ctx) {
    throw new Error('useApiClient must be used within ApiClientProvider')
  }
  return ctx
}
