/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useApiClient } from './ApiClientContext'
import type { AuthUser, GenericRecord } from '../types/backend'
import { formatBackendError } from '../utils/backendErrors'

type AuthContextValue = {
  idToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  loginEmail: (email: string, password: string) => Promise<void>
  signupEmail: (email: string, password: string) => Promise<void>
  loginGoogle: (googleIdToken: string) => Promise<void>
  fetchMe: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  forgotPassword: (email: string, continueUrl?: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

const TOKEN_STORAGE_KEY = 'workshopia.idToken'
const REFRESH_TOKEN_STORAGE_KEY = 'workshopia.refreshToken'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function asRecord(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseUser(payload: unknown): AuthUser | null {
  const row = asRecord(payload)
  const uid = asString(row.uid)
  const email = asString(row.email)
  if (!uid || !email) {
    return null
  }
  return {
    uid,
    email,
    displayName: asString(row.displayName) ?? undefined,
    provider: asString(row.provider) ?? undefined,
  }
}

function extractAuthData(payload: unknown): { idToken: string; refreshToken: string | null; user: AuthUser | null } {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Respuesta de auth invalida')
  }

  const data = payload as GenericRecord
  const token = asString(data.idToken ?? data.id_token ?? data.token)

  if (!token) {
    throw new Error('No se recibio idToken en respuesta de auth')
  }

  return {
    idToken: token,
    refreshToken: asString(data.refreshToken ?? data.refresh_token),
    user: parseUser(data.user),
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { request } = useApiClient()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    if (stored) {
      setIdToken(stored)
    }
    if (storedRefresh) {
      setRefreshToken(storedRefresh)
    }
  }, [])

  const persistAuth = useCallback((auth: { idToken: string; refreshToken: string | null; user: AuthUser | null }) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, auth.idToken)
    setIdToken(auth.idToken)
    setRefreshToken(auth.refreshToken)
    if (auth.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, auth.refreshToken)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    }
    if (auth.user) {
      setUser(auth.user)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const fetchMe = useCallback(async () => {
    if (!idToken) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/auth/me', {
        method: 'POST',
        body: { idToken },
      })
      setUser(parseUser(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No fue posible obtener usuario autenticado')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [idToken, request])

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/auth/login/email', {
          method: 'POST',
          body: { email, password },
        })
        persistAuth(extractAuthData(payload))
      } catch (err) {
        const message = formatBackendError(err, 'No fue posible iniciar sesion')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [persistAuth, request],
  )

  const signupEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/auth/signup/email', {
          method: 'POST',
          body: { email, password },
        })
        persistAuth(extractAuthData(payload))
      } catch (err) {
        const message = formatBackendError(err, 'No fue posible crear la cuenta')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [persistAuth, request],
  )

  const loginGoogle = useCallback(
    async (googleIdToken: string) => {
      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/auth/login/google', {
          method: 'POST',
          body: { idToken: googleIdToken },
        })
        persistAuth(extractAuthData(payload))
      } catch (err) {
        const message = formatBackendError(err, 'No fue posible iniciar sesion con Google')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [persistAuth, request],
  )

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!idToken) {
        throw new Error('Sesion no autenticada')
      }
      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/auth/password/change', {
          method: 'POST',
          body: { idToken, newPassword },
        })
        const parsed = extractAuthData(payload)
        persistAuth(parsed)
      } catch (err) {
        const message = formatBackendError(err, 'No fue posible cambiar la contrasena')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [idToken, persistAuth, request],
  )

  const forgotPassword = useCallback(
    async (email: string, continueUrl?: string) => {
      setLoading(true)
      setError(null)
      try {
        const effectiveContinueUrl =
          continueUrl ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
        await request('/auth/password/forgot', {
          method: 'POST',
          body: effectiveContinueUrl ? { email, continueUrl: effectiveContinueUrl } : { email },
        })
      } catch (err) {
        const message = formatBackendError(err, 'No fue posible enviar email de recuperacion')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request],
  )

  useEffect(() => {
    if (!idToken || user) {
      return
    }
    void fetchMe().catch(() => {
      // Error surfaced in context.
    })
  }, [fetchMe, idToken, user])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    setIdToken(null)
    setRefreshToken(null)
    setUser(null)
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      idToken,
      refreshToken,
      user,
      isAuthenticated: Boolean(idToken),
      loading,
      error,
      loginEmail,
      signupEmail,
      loginGoogle,
      fetchMe,
      changePassword,
      forgotPassword,
      logout,
      clearError,
    }),
    [
      changePassword,
      clearError,
      error,
      fetchMe,
      forgotPassword,
      idToken,
      loading,
      loginEmail,
      loginGoogle,
      logout,
      refreshToken,
      signupEmail,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
