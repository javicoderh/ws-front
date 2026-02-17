import type { ApiError } from '../types/backend'

type KnownCode =
  | 'WORKSHOP_HELPER_FORBIDDEN'
  | 'WORKSHOP_TOKENS_INSUFFICIENT'
  | 'WORKSHOP_TOKENS_CONCURRENT_UPDATE'
  | 'USER_PROFILE_NOT_FOUND'
  | 'WORKSHOP_HELPER_NOT_READY'

const CODE_HINTS: Record<KnownCode, string> = {
  WORKSHOP_HELPER_FORBIDDEN: 'Debes volver a autenticarte para continuar.',
  WORKSHOP_TOKENS_INSUFFICIENT: 'Necesitas comprar tokens para iniciar el helper.',
  WORKSHOP_TOKENS_CONCURRENT_UPDATE: 'Hubo una colision de saldo. Reintenta iniciar helper.',
  USER_PROFILE_NOT_FOUND: 'Completa tu perfil para continuar.',
  WORKSHOP_HELPER_NOT_READY: 'El helper aun no esta listo. Espera y vuelve a intentar.',
}

function asApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null) {
    const row = error as Record<string, unknown>
    return {
      code: typeof row.code === 'string' ? row.code : undefined,
      message: typeof row.message === 'string' ? row.message : 'Error inesperado',
      status: typeof row.status === 'number' ? row.status : undefined,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    }
  }

  return {
    message: 'Error inesperado',
  }
}

export function getErrorCode(error: unknown): string | undefined {
  return asApiError(error).code
}

export function formatBackendError(error: unknown, fallback: string): string {
  const apiError = asApiError(error)
  const message = apiError.message || fallback

  if (!apiError.code) {
    return message
  }

  const hint = CODE_HINTS[apiError.code as KnownCode]
  if (!hint) {
    return `[${apiError.code}] ${message}`
  }

  return `[${apiError.code}] ${message} ${hint}`
}
