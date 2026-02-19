export type JobFailureExplanation = {
  title: string
  detail: string
  action: string
}

export function explainJobFailure(error?: string): JobFailureExplanation | null {
  if (!error || !error.trim()) {
    return null
  }

  const normalized = error.toUpperCase()

  if (normalized.includes('LLM_CONNECT_ERROR') || normalized.includes('127.0.0.1:11434')) {
    return {
      title: 'No se pudo conectar al motor de IA',
      detail:
        'El backend no logró conectarse al servicio de modelo (LLM). La generación no alcanzó a comenzar.',
      action:
        'Verifica que el proveedor configurado esté activo (OpenAI/Ollama) y vuelve a intentar.',
    }
  }

  if (normalized.includes('WORKSHOP_HELPER_PIPELINE_EMAIL_FAILED') || normalized.includes('MAIL_SEND_FAILED')) {
    return {
      title: 'Falló el envío de correo',
      detail:
        'El workshop se generó, pero no se pudo enviar por correo por un problema SMTP o de credenciales.',
      action:
        'Revisa SMTP_USERNAME, SMTP_PASSWORD y EMAIL_FROM, luego reintenta el envío.',
    }
  }

  if (normalized.includes('INVALID_ID_TOKEN') || normalized.includes('AUTH')) {
    return {
      title: 'Tu sesión expiró',
      detail:
        'La solicitud fue rechazada por autenticación inválida o expirada durante el proceso.',
      action: 'Inicia sesión nuevamente y reintenta la generación.',
    }
  }

  if (normalized.includes('OPENAI') || normalized.includes('WORKSHOP_V4_SESSION_LLM_FAILED')) {
    return {
      title: 'Falló la generación con IA',
      detail:
        'Hubo un problema al validar o generar contenido con el modelo configurado.',
      action: 'Reintenta en unos segundos; si persiste, revisa API key/modelo y límites de uso.',
    }
  }

  return {
    title: 'La generación falló',
    detail: 'El backend informó un error técnico durante el pipeline de creación.',
    action: 'Reintenta y, si vuelve a ocurrir, comparte el detalle técnico con soporte.',
  }
}
