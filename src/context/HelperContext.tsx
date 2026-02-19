/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useApiClient } from './ApiClientContext'
import { useAuth } from './AuthContext'
import type {
  GenericRecord,
  UserEscalatedCaseItem,
  UserHelperSessionItem,
  HelperField,
  HelperMetrics,
  HelperState,
  HelperStep,
  JobStatus,
  QueueAheadItem,
  QueueStatus,
  WorkshopJobRecord,
} from '../types/backend'
import { formatBackendError } from '../utils/backendErrors'

type FinalizeResult = {
  sessionId: string
  status: string
  inputFulfilled: boolean
  payload?: unknown
  jobId?: string
  queuePosition?: number
  etaMinutes?: number
}

type HelperContextValue = {
  sessionId: string | null
  state: HelperState | null
  metrics: HelperMetrics | null
  jobId: string | null
  jobStatus: JobStatus | null
  queueStatus: QueueStatus | null
  userSessions: UserHelperSessionItem[]
  myEscalatedCases: UserEscalatedCaseItem[]
  loading: boolean
  error: string | null
  startSession: () => Promise<HelperState>
  loadState: (sessionIdArg?: string) => Promise<HelperState>
  answerStep: (stepId: string, answer: unknown) => Promise<HelperState>
  editStep: (stepId: string) => Promise<HelperState>
  resumeFailedJob: (jobId: string) => Promise<HelperState>
  startNewVersionFromJob: (jobId: string) => Promise<HelperState>
  finalizeSession: () => Promise<FinalizeResult>
  loadMetrics: (sessionIdArg?: string) => Promise<void>
  loadJobStatus: (jobIdArg?: string) => Promise<void>
  loadQueueStatus: () => Promise<void>
  loadUserSessions: () => Promise<void>
  loadMyEscalatedCases: () => Promise<void>
  reset: () => void
  clearError: () => void
}

const HelperContext = createContext<HelperContextValue | undefined>(undefined)
const HELPER_SESSION_STORAGE_KEY = 'workshopia.helperSessionId'
const HELPER_JOB_STORAGE_KEY = 'workshopia.helperJobId'

function readStoredSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const value = window.localStorage.getItem(HELPER_SESSION_STORAGE_KEY)
  if (!value || !value.trim()) {
    return null
  }
  return value.trim()
}

function persistSessionId(value: string | null): void {
  if (typeof window === 'undefined') {
    return
  }
  if (!value) {
    window.localStorage.removeItem(HELPER_SESSION_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(HELPER_SESSION_STORAGE_KEY, value)
}

function readStoredJobId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const value = window.localStorage.getItem(HELPER_JOB_STORAGE_KEY)
  if (!value || !value.trim()) {
    return null
  }
  return value.trim()
}

function persistJobId(value: string | null): void {
  if (typeof window === 'undefined') {
    return
  }
  if (!value) {
    window.localStorage.removeItem(HELPER_JOB_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(HELPER_JOB_STORAGE_KEY, value)
}

function record(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asBool(value: unknown): boolean {
  return value === true
}

function parseHelperField(field: unknown): HelperField | null {
  const row = record(field)
  const id = asString(row.id)
  const label = asString(row.label)
  if (!id || !label) {
    return null
  }

  const options = Array.isArray(row.options)
    ? row.options
        .map((option) => {
          const item = record(option)
          const value = asString(item.value)
          const optionLabel = asString(item.label)
          if (!value || !optionLabel) {
            return null
          }
          return { value, label: optionLabel }
        })
        .filter((item): item is { value: string; label: string } => item !== null)
    : undefined

  return {
    id,
    label,
    required: asBool(row.required),
    valueType: asString(row.valueType),
    minLen: asNumber(row.minLen),
    maxLen: asNumber(row.maxLen),
    min: asNumber(row.min),
    max: asNumber(row.max),
    options,
    voiceMaxSeconds: asNumber(row.voiceMaxSeconds),
    help: asString(row.help),
  }
}

function parseQueueAheadItem(item: unknown): QueueAheadItem | null {
  const row = record(item)
  const jobId = asString(row.jobId)
  const workshopName = asString(row.workshopName)
  if (!jobId || !workshopName) {
    return null
  }
  return { jobId, workshopName }
}

function parseWorkshopJob(item: unknown): WorkshopJobRecord | null {
  const row = record(item)
  const jobId = asString(row.jobId)
  const workshopId = asString(row.workshopId)
  const helperSessionId = asString(row.helperSessionId)
  const workshopName = asString(row.workshopName)
  if (!jobId || !workshopId || !helperSessionId || !workshopName) {
    return null
  }

  return {
    jobId,
    workshopId,
    helperSessionId,
    uid: asString(row.uid),
    workshopName,
    status: asString(row.status) ?? 'unknown',
    createdAtEpoch: asNumber(row.createdAtEpoch) ?? 0,
    startedAtEpoch: asNumber(row.startedAtEpoch),
    finishedAtEpoch: asNumber(row.finishedAtEpoch),
    error: asString(row.error),
    inputSnapshot: row.inputSnapshot,
    payload: row.payload,
    raw: row,
  }
}

function parseHelperState(payload: unknown): HelperState {
  const raw = record(payload)
  const fields = Array.isArray(raw.fields)
    ? raw.fields.map(parseHelperField).filter((f): f is HelperField => f !== null)
    : []

  const steps: HelperStep[] = Array.isArray(raw.steps)
    ? raw.steps
        .map((step) => {
          const row = record(step)
          const stepId = asString(row.stepId)
          if (!stepId) {
            return null
          }
          const parsedFields = Array.isArray(row.fields)
            ? row.fields.map(parseHelperField).filter((f): f is HelperField => f !== null)
            : []

          const next: HelperStep = {
            stepId,
            title: asString(row.title) ?? stepId,
            prompt: asString(row.prompt) ?? '',
            stepType: asString(row.stepType) ?? 'question',
            status: asString(row.status) ?? 'pending',
            attempt: asNumber(row.attempt) ?? 0,
            maxAttempts: asNumber(row.maxAttempts) ?? 0,
            fields: parsedFields,
            feedback: asString(row.feedback),
            suggestions: Array.isArray(row.suggestions)
              ? row.suggestions.filter((s): s is string => typeof s === 'string')
              : [],
          }
          return next
        })
        .filter((step): step is HelperStep => step !== null)
    : []

  return {
    sessionId: asString(raw.sessionId) ?? '',
    mode: asString(raw.mode),
    status: asString(raw.status) ?? 'in_progress',
    currentStepId: asString(raw.currentStepId) ?? '',
    currentStepType: asString(raw.currentStepType),
    attempt: asNumber(raw.attempt) ?? 0,
    maxAttempts: asNumber(raw.maxAttempts) ?? 0,
    prompt: asString(raw.prompt) ?? '',
    fields,
    feedback: asString(raw.feedback),
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.filter((s): s is string => typeof s === 'string')
      : [],
    steps,
    canFinalize: asBool(raw.canFinalize),
    raw,
  }
}

function parseJobStatus(payload: unknown): JobStatus {
  const raw = record(payload)
  const job = parseWorkshopJob(raw.job)
  if (!job) {
    throw new Error('Formato de estado de job invalido')
  }

  return {
    job,
    runningCount: asNumber(raw.runningCount) ?? 0,
    maxParallel: asNumber(raw.maxParallel) ?? 1,
    queuePosition: asNumber(raw.queuePosition),
    jobsAhead: Array.isArray(raw.jobsAhead)
      ? raw.jobsAhead
          .map(parseQueueAheadItem)
          .filter((item): item is QueueAheadItem => item !== null)
      : [],
    etaMinutes: asNumber(raw.etaMinutes),
    raw,
  }
}

function parseQueueStatus(payload: unknown): QueueStatus {
  const raw = record(payload)

  const parseQueueItem = (item: unknown): QueueStatus['running'][number] | null => {
    const row = record(item)
    const jobId = asString(row.jobId)
    const workshopName = asString(row.workshopName)
    if (!jobId || !workshopName) {
      return null
    }
    return {
      jobId,
      workshopName,
      status: asString(row.status) ?? 'unknown',
      createdAtEpoch: asNumber(row.createdAtEpoch) ?? 0,
    }
  }

  return {
    runningCount: asNumber(raw.runningCount) ?? 0,
    maxParallel: asNumber(raw.maxParallel) ?? 1,
    queuedCount: asNumber(raw.queuedCount) ?? 0,
    etaPerWorkshopMinutes: asNumber(raw.etaPerWorkshopMinutes) ?? 0,
    etaSafetyFactor: asNumber(raw.etaSafetyFactor) ?? 1,
    running: Array.isArray(raw.running)
      ? raw.running
          .map(parseQueueItem)
          .filter((item): item is QueueStatus['running'][number] => item !== null)
      : [],
    waitingQueue: Array.isArray(raw.waitingQueue)
      ? raw.waitingQueue
          .map(parseQueueItem)
          .filter((item): item is QueueStatus['waitingQueue'][number] => item !== null)
      : [],
    raw,
  }
}

function parseFinalizeResult(payload: unknown): FinalizeResult {
  const raw = record(payload)
  return {
    sessionId: asString(raw.sessionId) ?? '',
    status: asString(raw.status) ?? 'queued',
    inputFulfilled: asBool(raw.inputFulfilled),
    payload: raw.payload,
    jobId: asString(raw.jobId),
    queuePosition: asNumber(raw.queuePosition),
    etaMinutes: asNumber(raw.etaMinutes),
  }
}

function parseMetrics(payload: unknown): HelperMetrics {
  const row = record(payload)
  return {
    sessionId: asString(row.sessionId) ?? '',
    status: asString(row.status) ?? 'unknown',
    inputFulfilled: asBool(row.inputFulfilled),
    openaiRequests: asNumber(row.openaiRequests) ?? 0,
    openaiPromptTokens: asNumber(row.openaiPromptTokens) ?? 0,
    openaiCompletionTokens: asNumber(row.openaiCompletionTokens) ?? 0,
    openaiTotalTokens: asNumber(row.openaiTotalTokens) ?? 0,
    openaiCostUsd: asNumber(row.openaiCostUsd) ?? 0,
  }
}

function parseUserSessions(payload: unknown): UserHelperSessionItem[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map((item) => {
      const row = record(item)
      const sessionId = asString(row.sessionId)
      const status = asString(row.status)
      const currentStepId = asString(row.currentStepId)
      const currentStepTitle = asString(row.currentStepTitle)
      if (!sessionId || !status || !currentStepId || !currentStepTitle) {
        return null
      }
      const parsed: UserHelperSessionItem = {
        sessionId,
        status,
        currentStepId,
        currentStepTitle,
      }
      const mode = asString(row.mode)
      if (mode) {
        parsed.mode = mode
      }
      return parsed
    })
    .filter((row) => row !== null) as UserHelperSessionItem[]
}

function parseMyEscalatedCases(payload: unknown): UserEscalatedCaseItem[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map((item) => {
      const row = record(item)
      const caseId = asString(row.caseId)
      const sessionId = asString(row.sessionId)
      const stepId = asString(row.stepId)
      const reason = asString(row.reason)
      const attentionStatus = asString(row.attentionStatus)
      if (!caseId || !sessionId || !stepId || !reason || !attentionStatus) {
        return null
      }
      return {
        caseId,
        sessionId,
        stepId,
        reason,
        resolved: asBool(row.resolved),
        attentionStatus,
      }
    })
    .filter((row): row is UserEscalatedCaseItem => row !== null)
}

export function HelperProvider({ children }: PropsWithChildren) {
  const { request } = useApiClient()
  const { idToken } = useAuth()

  const [sessionId, setSessionId] = useState<string | null>(() => readStoredSessionId())
  const [state, setState] = useState<HelperState | null>(null)
  const [metrics, setMetrics] = useState<HelperMetrics | null>(null)
  const [jobId, setJobId] = useState<string | null>(() => readStoredJobId())
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [userSessions, setUserSessions] = useState<UserHelperSessionItem[]>([])
  const [myEscalatedCases, setMyEscalatedCases] = useState<UserEscalatedCaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withToken = useCallback(() => {
    if (!idToken) {
      throw new Error('Sesion no autenticada')
    }
    return idToken
  }, [idToken])

  const clearError = useCallback(() => setError(null), [])

  const startSession = useCallback(async (): Promise<HelperState> => {
    const token = withToken()
    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>('/workshop-helper/session/start', {
        method: 'POST',
        body: { idToken: token, mode: 'written' },
      })
      const parsed = parseHelperState(payload)
      if (!parsed.sessionId) {
        throw new Error('No se recibio sessionId al iniciar helper')
      }
      setSessionId(parsed.sessionId)
      persistSessionId(parsed.sessionId)
      setState(parsed)
      setJobId(null)
      persistJobId(null)
      setJobStatus(null)
      setQueueStatus(null)
      setMetrics(null)
      return parsed
    } catch (err) {
      const message = formatBackendError(err, 'No fue posible iniciar helper')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, withToken])

  const loadState = useCallback(
    async (sessionIdArg?: string) => {
      const token = withToken()
      const target = sessionIdArg ?? sessionId ?? readStoredSessionId()
      if (!target) {
        throw new Error('No existe sessionId activa')
      }

      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>(
          `/workshop-helper/session/${target}/state?idToken=${encodeURIComponent(token)}`,
        )
        const parsed = parseHelperState(payload)
        setState(parsed)
        setSessionId(parsed.sessionId)
        persistSessionId(parsed.sessionId)
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo cargar estado del helper')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, sessionId, withToken],
  )

  const answerStep = useCallback(
    async (stepId: string, answer: unknown) => {
      const token = withToken()
      const target = sessionId ?? readStoredSessionId()
      if (!target) {
        throw new Error('No existe sessionId activa')
      }

      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>(`/workshop-helper/session/${target}/answer`, {
          method: 'POST',
          body: { idToken: token, stepId, answer },
        })
        const parsed = parseHelperState(payload)
        setState(parsed)
        setSessionId(parsed.sessionId)
        persistSessionId(parsed.sessionId)
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo responder el step')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, sessionId, withToken],
  )

  const editStep = useCallback(
    async (stepId: string) => {
      const token = withToken()
      const target = sessionId ?? readStoredSessionId()
      if (!target) {
        throw new Error('No existe sessionId activa')
      }

      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>(`/workshop-helper/session/${target}/edit-step`, {
          method: 'POST',
          body: { idToken: token, stepId },
        })
        const parsed = parseHelperState(payload)
        setState(parsed)
        setSessionId(parsed.sessionId)
        persistSessionId(parsed.sessionId)
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo editar el step')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, sessionId, withToken],
  )

  const finalizeSession = useCallback(async (): Promise<FinalizeResult> => {
    const token = withToken()
    const target = sessionId ?? readStoredSessionId()
    if (!target) {
      throw new Error('No existe sessionId activa')
    }

    setLoading(true)
    setError(null)
    try {
      const payload = await request<unknown>(`/workshop-helper/session/${target}/finalize`, {
        method: 'POST',
        body: { idToken: token },
      })
      const result = parseFinalizeResult(payload)
      if (result.jobId) {
        setJobId(result.jobId)
        persistJobId(result.jobId)
      }
      return result
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo finalizar helper')
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [request, sessionId, withToken])

  const resumeFailedJob = useCallback(
    async (failedJobId: string): Promise<HelperState> => {
      const token = withToken()
      if (!failedJobId.trim()) {
        throw new Error('jobId fallido es requerido')
      }

      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/workshop-helper/session/resume-failed-job', {
          method: 'POST',
          body: { idToken: token, jobId: failedJobId.trim() },
        })
        const parsed = parseHelperState(payload)
        setState(parsed)
        setSessionId(parsed.sessionId)
        persistSessionId(parsed.sessionId)
        setJobId(failedJobId.trim())
        persistJobId(failedJobId.trim())
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo reabrir la sesion desde el job fallido')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, withToken],
  )

  const startNewVersionFromJob = useCallback(
    async (jobIdSource: string): Promise<HelperState> => {
      const token = withToken()
      if (!jobIdSource.trim()) {
        throw new Error('jobId es requerido para nueva versión')
      }

      setLoading(true)
      setError(null)
      try {
        const payload = await request<unknown>('/workshop-helper/session/new-version-from-job', {
          method: 'POST',
          body: { idToken: token, jobId: jobIdSource.trim() },
        })
        const parsed = parseHelperState(payload)
        setState(parsed)
        setSessionId(parsed.sessionId)
        persistSessionId(parsed.sessionId)
        setJobId(null)
        persistJobId(null)
        return parsed
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo iniciar nueva versión desde el historial')
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [request, withToken],
  )

  const loadMetrics = useCallback(
    async (sessionIdArg?: string) => {
      const token = withToken()
      const target = sessionIdArg ?? sessionId ?? readStoredSessionId()
      if (!target) {
        throw new Error('No existe sessionId activa')
      }

      setError(null)
      try {
        const payload = await request<unknown>(
          `/workshop-helper/session/${target}/metrics?idToken=${encodeURIComponent(token)}`,
        )
        setMetrics(parseMetrics(payload))
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo cargar metricas del helper')
        setError(message)
        throw err
      }
    },
    [request, sessionId, withToken],
  )

  const loadJobStatus = useCallback(
    async (jobIdArg?: string) => {
      const target = jobIdArg ?? jobId ?? readStoredJobId()
      if (!target) {
        throw new Error('No existe jobId activo')
      }

      setError(null)
      try {
        const payload = await request<unknown>(`/workshops/jobs/${target}/status`)
        const parsed = parseJobStatus(payload)
        setJobStatus(parsed)
        setJobId(target)
        persistJobId(target)
      } catch (err) {
        const message = formatBackendError(err, 'No se pudo cargar estado del job')
        setError(message)
        throw err
      }
    },
    [jobId, request],
  )

  const loadQueueStatus = useCallback(async () => {
    setError(null)
    try {
      const payload = await request<unknown>('/workshops/queue/status')
      setQueueStatus(parseQueueStatus(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo cargar estado global de cola')
      setError(message)
      throw err
    }
  }, [request])

  const loadUserSessions = useCallback(async () => {
    const token = withToken()
    setError(null)
    try {
      const payload = await request<unknown>('/workshop-helper/sessions/list', {
        method: 'POST',
        body: { idToken: token },
      })
      setUserSessions(parseUserSessions(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudieron cargar tus sesiones helper')
      setError(message)
      throw err
    }
  }, [request, withToken])

  const loadMyEscalatedCases = useCallback(async () => {
    const token = withToken()
    setError(null)
    try {
      const payload = await request<unknown>('/workshop-helper/escalated/my', {
        method: 'POST',
        body: { idToken: token },
      })
      setMyEscalatedCases(parseMyEscalatedCases(payload))
    } catch (err) {
      const message = formatBackendError(err, 'No se pudieron cargar tus casos escalados')
      setError(message)
      throw err
    }
  }, [request, withToken])

  const reset = useCallback(() => {
    setSessionId(null)
    persistSessionId(null)
    setState(null)
    setMetrics(null)
    setJobId(null)
    persistJobId(null)
    setJobStatus(null)
    setQueueStatus(null)
    setUserSessions([])
    setMyEscalatedCases([])
    setError(null)
  }, [])

  const value = useMemo<HelperContextValue>(
    () => ({
      sessionId,
      state,
      metrics,
      jobId,
      jobStatus,
      queueStatus,
      userSessions,
      myEscalatedCases,
      loading,
      error,
      startSession,
      loadState,
      answerStep,
      editStep,
      resumeFailedJob,
      startNewVersionFromJob,
      finalizeSession,
      loadMetrics,
      loadJobStatus,
      loadQueueStatus,
      loadUserSessions,
      loadMyEscalatedCases,
      reset,
      clearError,
    }),
    [
      answerStep,
      clearError,
      editStep,
      resumeFailedJob,
      startNewVersionFromJob,
      error,
      finalizeSession,
      jobId,
      jobStatus,
      loadMyEscalatedCases,
      loadJobStatus,
      loadMetrics,
      loadQueueStatus,
      loadUserSessions,
      loadState,
      loading,
      myEscalatedCases,
      metrics,
      queueStatus,
      reset,
      sessionId,
      startSession,
      state,
      userSessions,
    ],
  )

  return <HelperContext.Provider value={value}>{children}</HelperContext.Provider>
}

export function useHelper() {
  const ctx = useContext(HelperContext)
  if (!ctx) {
    throw new Error('useHelper must be used within HelperProvider')
  }
  return ctx
}
