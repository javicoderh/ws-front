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
const TOKEN_STORAGE_KEY = 'workshopia.idToken'
const REFRESH_TOKEN_STORAGE_KEY = 'workshopia.refreshToken'

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

function readStorageValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const value = window.localStorage.getItem(key)
  if (!value || !value.trim()) {
    return null
  }
  return value.trim()
}

function patchAuthInRequest(path: string, options?: RequestOptions): { path: string; options?: RequestOptions } {
  const idToken = readStorageValue(TOKEN_STORAGE_KEY)
  if (!idToken) {
    return { path, options }
  }

  let nextPath = path
  if (path.includes('idToken=')) {
    const [base, query = ''] = path.split('?')
    const params = new URLSearchParams(query)
    if (params.has('idToken')) {
      params.set('idToken', idToken)
      nextPath = `${base}?${params.toString()}`
    }
  }

  if (!options?.body || typeof options.body.idToken !== 'string') {
    return nextPath === path ? { path, options } : { path: nextPath, options: { ...options } }
  }

  const nextBody: GenericRecord = { ...options.body, idToken }
  return {
    path: nextPath,
    options: {
      ...options,
      body: nextBody,
    },
  }
}

function shouldAttemptRefresh(path: string, status: number, payload: unknown): boolean {
  if (path.startsWith('/auth/refresh')) {
    return false
  }
  const apiError = toApiError(status, payload)
  if (apiError.code === 'FIREBASE_AUTH_BAD_REQUEST' && apiError.message.includes('INVALID_ID_TOKEN')) {
    return true
  }
  return apiError.message.includes('INVALID_ID_TOKEN')
}

async function refreshAuthSession(baseUrl: string): Promise<boolean> {
  const refreshToken = readStorageValue(REFRESH_TOKEN_STORAGE_KEY)
  if (!refreshToken) {
    return false
  }

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })
  if (!response.ok) {
    return false
  }

  const payload = (await response.json()) as GenericRecord
  const nextIdToken = typeof payload.idToken === 'string' ? payload.idToken : null
  const nextRefreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken : null
  if (!nextIdToken) {
    return false
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextIdToken)
    if (nextRefreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, nextRefreshToken)
    }
    window.dispatchEvent(new CustomEvent('workshopia:auth-refreshed', { detail: { idToken: nextIdToken } }))
  }
  return true
}

export function ApiClientProvider({ children }: PropsWithChildren) {
  const value = useMemo<ApiClientContextValue>(() => {
    const baseUrl = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:3000'

    const request = async <T,>(path: string, options?: RequestOptions): Promise<T> => {
      const run = async (allowRefreshRetry: boolean): Promise<T> => {
        const patched = patchAuthInRequest(path, options)
        const method = patched.options?.method ?? 'GET'
        const response = await fetch(`${baseUrl}${patched.path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: patched.options?.body ? JSON.stringify(patched.options.body) : undefined,
          signal: patched.options?.signal,
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
          if (allowRefreshRetry && shouldAttemptRefresh(patched.path, response.status, payload)) {
            const refreshed = await refreshAuthSession(baseUrl)
            if (refreshed) {
              return run(false)
            }
          }
          throw toErrorObject(toApiError(response.status, payload))
        }

        return payload as T
      }

      return run(true)
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
