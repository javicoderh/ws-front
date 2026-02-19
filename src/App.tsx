import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { AuthScreen } from './components/AuthScreen'
import { DashboardScreen } from './components/DashboardScreen'
import { GenerationStatusScreen } from './components/GenerationStatusScreen'
import { HelperStepperScreen } from './components/HelperStepperScreen'
import { LandingScreen } from './components/LandingScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { TokenPurchaseScreen } from './components/TokenPurchaseScreen'
import { WorkshopDetailScreen } from './components/WorkshopDetailScreen'
import { WorkshopHistoryScreen } from './components/WorkshopHistoryScreen'
import { useApiClient } from './context/ApiClientContext'
import { useAuth } from './context/AuthContext'
import { useHelper } from './context/HelperContext'
import { useTokens } from './context/TokensContext'
import { useWorkshops } from './context/WorkshopsContext'
import type { GenericRecord, Profile, WorkshopRecord } from './types/backend'
import { formatBackendError, getErrorCode } from './utils/backendErrors'

type DashboardNotice = 'continue_session' | 'no_credits' | null

function asRecord(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function parseProfile(payload: unknown): Profile | null {
  const row = asRecord(payload)
  if (typeof row.uid !== 'string' || typeof row.email !== 'string') {
    return null
  }
  return {
    uid: row.uid,
    email: row.email,
    username: typeof row.username === 'string' ? row.username : '',
    displayName: typeof row.displayName === 'string' ? row.displayName : '',
    phoneE164: typeof row.phoneE164 === 'string' ? row.phoneE164 : '',
    whatsappCountryCode:
      typeof row.whatsappCountryCode === 'string' ? row.whatsappCountryCode : '',
    countryOfResidence: typeof row.countryOfResidence === 'string' ? row.countryOfResidence : '',
    profileImageUrl: typeof row.profileImageUrl === 'string' ? row.profileImageUrl : '',
    credential: typeof row.credential === 'string' ? row.credential : undefined,
    workshopTokensBalance:
      typeof row.workshopTokensBalance === 'number' ? row.workshopTokensBalance : 0,
    createdAtEpoch: typeof row.createdAtEpoch === 'number' ? row.createdAtEpoch : undefined,
    updatedAtEpoch: typeof row.updatedAtEpoch === 'number' ? row.updatedAtEpoch : undefined,
  }
}

function ProtectedRoute({ isAuthenticated, children }: { isAuthenticated: boolean; children: ReactNode }) {
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }
  return children
}

function App() {
  const { request } = useApiClient()
  const auth = useAuth()
  const tokens = useTokens()
  const helper = useHelper()
  const workshops = useWorkshops()
  const navigate = useNavigate()
  const location = useLocation()

  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopRecord | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [dashboardNotice, setDashboardNotice] = useState<DashboardNotice>(null)
  const [pendingHelperSessionId, setPendingHelperSessionId] = useState<string | null>(null)

  const generatedWorkshops = useMemo(() => {
    const isGenerated = (item: WorkshopRecord) => {
      const status = (item.status ?? '').toLowerCase()
      return status === 'done' || status === 'completed' || status === 'finished'
    }

    const combined = [...workshops.list, ...workshops.history].filter(isGenerated)
    const byKey = new Map<string, WorkshopRecord>()

    for (const item of combined) {
      const raw = asRecord(item.raw)
      const workshopId = typeof raw.workshopId === 'string' ? raw.workshopId : ''
      const fallbackTitle = item.title.trim().toLowerCase()
      const key = workshopId || fallbackTitle || item.id
      const currentEpoch = item.updatedAtEpoch ?? item.createdAtEpoch ?? 0
      const previous = byKey.get(key)
      const previousEpoch = previous ? (previous.updatedAtEpoch ?? previous.createdAtEpoch ?? 0) : -1

      if (!previous || currentEpoch >= previousEpoch) {
        byKey.set(key, item)
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aEpoch = a.updatedAtEpoch ?? a.createdAtEpoch ?? 0
      const bEpoch = b.updatedAtEpoch ?? b.createdAtEpoch ?? 0
      return bEpoch - aEpoch
    })
  }, [workshops.history, workshops.list])

  const loadProfile = async () => {
    if (!auth.idToken) {
      return null
    }

    setProfileLoading(true)
    setProfileError(null)
    try {
      const payload = await request<unknown>('/users/profile/get', {
        method: 'POST',
        body: { idToken: auth.idToken },
      })
      const parsed = parseProfile(payload)
      setProfile(parsed)
      return parsed
    } catch (err) {
      const code = getErrorCode(err)
      if (code === 'USER_PROFILE_NOT_FOUND') {
        setProfile(null)
        navigate('/profile')
        return null
      }
      const message = formatBackendError(err, 'No se pudo cargar perfil')
      setProfileError(message)
      throw err
    } finally {
      setProfileLoading(false)
    }
  }

  const upsertProfile = async (draft: {
    username: string
    displayName: string
    phoneE164: string
    whatsappCountryCode: string
    countryOfResidence: string
    profileImageUrl: string
  }) => {
    if (!auth.idToken) {
      throw new Error('Sesion no autenticada')
    }
    setProfileLoading(true)
    setProfileError(null)
    try {
      const payload = await request<unknown>('/users/profile/upsert', {
        method: 'POST',
        body: {
          idToken: auth.idToken,
          username: draft.username,
          displayName: draft.displayName,
          phoneE164: draft.phoneE164,
          whatsappCountryCode: draft.whatsappCountryCode,
          countryOfResidence: draft.countryOfResidence,
          profileImageUrl: draft.profileImageUrl,
        },
      })
      const parsed = parseProfile(payload)
      setProfile(parsed)
      await tokens.refreshBalance()
      navigate('/dashboard')
    } catch (err) {
      const message = formatBackendError(err, 'No se pudo guardar perfil')
      setProfileError(message)
      throw err
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    if (!auth.isAuthenticated) {
      helper.reset()
      setProfile(null)
      setDashboardNotice(null)
      setPendingHelperSessionId(null)
      return
    }

    if (location.pathname === '/auth') {
      void loadProfile()
        .then((p) => {
          if (p) {
            navigate('/dashboard', { replace: true })
            return tokens.refreshBalance()
          }
          return Promise.resolve()
        })
        .catch(() => {
          // Errors visible through context states.
        })
    }
  }, [auth.isAuthenticated, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paymentSessionId = params.get('paymentSessionId') ?? params.get('payment_session_id')
    const hasPaymentReturnSignal =
      Boolean(paymentSessionId) ||
      params.has('collection_id') ||
      params.has('payment_id') ||
      params.has('status') ||
      params.has('external_reference')
    if (!hasPaymentReturnSignal || !auth.isAuthenticated) {
      return
    }

    void tokens
      .confirmCheckout(paymentSessionId ?? undefined)
      .then(() => tokens.refreshBalance())
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        // Error visible through tokens context.
      })
  }, [auth.isAuthenticated, location.search, navigate, tokens])

  useEffect(() => {
    if (location.pathname !== '/generation' || !helper.jobId) {
      return
    }

    const tick = () => {
      void Promise.all([helper.loadJobStatus(), helper.loadQueueStatus()]).catch(() => {
        // Error visible through context.
      })
    }

    tick()
    const id = window.setInterval(tick, 3000)
    return () => window.clearInterval(id)
  }, [helper, location.pathname])

  useEffect(() => {
    if (location.pathname !== '/dashboard' || !auth.isAuthenticated) {
      return
    }
    void Promise.all([
      helper.loadUserSessions(),
      helper.loadMyEscalatedCases(),
      workshops.loadList(),
      workshops.loadHistory(),
    ]).catch(() => {
      // Error visible through helper/workshops context.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auth.isAuthenticated,
    helper.loadMyEscalatedCases,
    helper.loadUserSessions,
    location.pathname,
    workshops.loadHistory,
    workshops.loadList,
  ])

  useEffect(() => {
    if (location.pathname !== '/helper' || !auth.isAuthenticated) {
      return
    }
    if (helper.loading) {
      return
    }
    if (helper.state) {
      return
    }
    if (!helper.sessionId) {
      return
    }
    void helper.loadState(helper.sessionId).catch(() => {
      // Error visible through helper context.
    })
  }, [auth.isAuthenticated, helper, location.pathname])

  const globalError = useMemo(() => {
    return auth.error ?? profileError ?? tokens.error ?? helper.error ?? workshops.error ?? null
  }, [auth.error, helper.error, profileError, tokens.error, workshops.error])

  const handleStartHelper = async () => {
    setDashboardNotice(null)
    setPendingHelperSessionId(null)
    try {
      const started = await helper.startSession()
      const firstStepId = started.steps[0]?.stepId
      const hasProgress =
        started.steps.some((step) => step.status === 'validated' || step.attempt > 0) ||
        Boolean(firstStepId && started.currentStepId !== firstStepId)

      if (hasProgress) {
        setPendingHelperSessionId(started.sessionId)
        setDashboardNotice('continue_session')
        return
      }

      await helper.loadState(started.sessionId)
      navigate('/helper')
    } catch (error) {
      const code = getErrorCode(error)
      if (code === 'WORKSHOP_TOKENS_INSUFFICIENT') {
        try {
          await tokens.confirmCheckout()
          await tokens.refreshBalance()
          const startedAfterTopup = await helper.startSession()
          const firstStepId = startedAfterTopup.steps[0]?.stepId
          const hasProgress =
            startedAfterTopup.steps.some((step) => step.status === 'validated' || step.attempt > 0) ||
            Boolean(firstStepId && startedAfterTopup.currentStepId !== firstStepId)
          if (hasProgress) {
            setPendingHelperSessionId(startedAfterTopup.sessionId)
            setDashboardNotice('continue_session')
            return
          }
          await helper.loadState(startedAfterTopup.sessionId)
          navigate('/helper')
          return
        } catch {
          setDashboardNotice('no_credits')
          return
        }
      }
      if (code === 'WORKSHOP_HELPER_FORBIDDEN') {
        auth.logout()
        helper.reset()
        navigate('/auth')
      }
    }
  }

  const handleFinalize = async () => {
    await helper.finalizeSession()
    await Promise.all([helper.loadJobStatus(), helper.loadQueueStatus()])
    navigate('/generation')
  }

  const handleLandingStart = async () => {
    if (!auth.isAuthenticated) {
      navigate('/auth')
      return
    }
    await handleStartHelper()
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingScreen
            loading={auth.loading || helper.loading}
            isAuthenticated={auth.isAuthenticated}
            onStartCreation={handleLandingStart}
            onGoAuth={() => navigate(auth.isAuthenticated ? '/dashboard' : '/auth')}
          />
        }
      />

      <Route
        path="/auth"
        element={
          <AuthScreen
            loading={auth.loading}
            error={auth.error}
            onLogin={auth.loginEmail}
            onSignup={auth.signupEmail}
            onGoogleLogin={auth.loginGoogle}
            onForgotPassword={auth.forgotPassword}
          />
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <ProfileScreen
              profile={profile}
              loading={profileLoading}
              error={globalError}
              onSubmit={upsertProfile}
              onRefresh={async () => {
                await loadProfile()
              }}
              onBack={() => navigate('/dashboard')}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <DashboardScreen
              balance={tokens.balance}
              helperSessions={helper.userSessions}
              escalatedCases={helper.myEscalatedCases}
              generatedWorkshops={generatedWorkshops}
              loading={tokens.loading || helper.loading}
              error={globalError}
              noticeMessage={
                dashboardNotice === 'continue_session'
                  ? 'Tienes una sesion de helper en curso.'
                  : dashboardNotice === 'no_credits'
                    ? 'No tienes creditos para crear un workshop. Para comprar creditos presiona aca.'
                    : null
              }
              noticePrimaryLabel={
                dashboardNotice === 'continue_session'
                  ? 'Continuar sesion'
                  : dashboardNotice === 'no_credits'
                    ? 'Comprar creditos'
                    : null
              }
              noticeSecondaryLabel={dashboardNotice === 'continue_session' ? 'Cerrar' : null}
              onRefresh={tokens.refreshBalance}
              onStartHelper={handleStartHelper}
              onOpenSession={async (targetSessionId) => {
                await helper.loadState(targetSessionId)
                navigate('/helper')
              }}
              onNoticePrimary={async () => {
                if (dashboardNotice === 'continue_session') {
                  const target = pendingHelperSessionId ?? helper.sessionId
                  if (!target) {
                    setDashboardNotice(null)
                    return
                  }
                  await helper.loadState(target)
                  setDashboardNotice(null)
                  setPendingHelperSessionId(null)
                  navigate('/helper')
                  return
                }
                if (dashboardNotice === 'no_credits') {
                  setDashboardNotice(null)
                  navigate('/tokens')
                }
              }}
              onNoticeSecondary={() => {
                setDashboardNotice(null)
                setPendingHelperSessionId(null)
              }}
              onGoPurchase={() => navigate('/tokens')}
              onGoProfile={() => {
                void loadProfile().then(() => navigate('/profile'))
              }}
              onGoHistory={() => {
                void Promise.all([workshops.loadHistory(), workshops.loadList()]).then(() =>
                  navigate('/history'),
                )
              }}
              onChangePassword={async () => {
                const nextPassword = window.prompt('Nueva contrasena (min 6):')
                if (!nextPassword) return
                await auth.changePassword(nextPassword)
              }}
              onLogout={() => {
                auth.logout()
                helper.reset()
                navigate('/')
              }}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tokens"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <TokenPurchaseScreen
              packs={tokens.packs}
              unitPriceClp={tokens.pricing?.unitPriceClp ?? null}
              unitPriceUsd={tokens.pricing?.unitPriceUsd ?? null}
              loading={tokens.loading}
              error={globalError}
              onBack={() => navigate('/dashboard')}
              onLoadPacks={tokens.loadTokenPacks}
              onLoadPricing={tokens.loadPricing}
              onLoadHistory={tokens.loadHistory}
              onLoadPurchaseHistory={tokens.loadPurchaseHistory}
              onStartCheckout={tokens.startCheckout}
              onConfirmCheckout={async () => {
                await tokens.confirmCheckout()
                await tokens.refreshBalance()
                navigate('/dashboard')
              }}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/helper"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <HelperStepperScreen
              helperState={helper.state}
              loading={helper.loading}
              error={globalError}
              onRefresh={async () => {
                await helper.loadState()
              }}
              onAnswer={async (stepId, answer) => {
                await helper.answerStep(stepId, answer)
              }}
              onEditStep={async (stepId) => {
                await helper.editStep(stepId)
              }}
              onFinalize={handleFinalize}
              onBack={() => navigate('/dashboard')}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/generation"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <GenerationStatusScreen
              jobId={helper.jobId}
              jobStatus={helper.jobStatus}
              queueStatus={helper.queueStatus}
              loading={helper.loading}
              error={globalError}
              onRefresh={async () => {
                await Promise.all([helper.loadJobStatus(), helper.loadQueueStatus(), helper.loadMetrics()])
              }}
              onResumeFromFailedJob={async () => {
                const failedJobId = helper.jobStatus?.job.jobId ?? helper.jobId
                if (!failedJobId) {
                  return
                }
                await helper.resumeFailedJob(failedJobId)
                navigate('/helper')
              }}
              onBackDashboard={() => navigate('/dashboard')}
              onGoHistory={() => {
                void Promise.all([workshops.loadHistory(), workshops.loadList()]).then(() =>
                  navigate('/history'),
                )
              }}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/history"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            <WorkshopHistoryScreen
              history={workshops.history}
              loading={workshops.loading}
              error={globalError}
              onBack={() => navigate('/dashboard')}
              onRefresh={async () => {
                await Promise.all([workshops.loadHistory(), workshops.loadList()])
              }}
              onOpenGeneration={async (workshop) => {
                const raw = workshop.raw as Record<string, unknown>
                const jobId =
                  (typeof raw.jobId === 'string' && raw.jobId) ||
                  (typeof raw.job_id === 'string' && raw.job_id) ||
                  ''
                if (!jobId) {
                  return
                }
                await Promise.all([helper.loadJobStatus(jobId), helper.loadQueueStatus()])
                navigate('/generation')
              }}
              onGenerateNewVersion={async (workshop) => {
                const raw = workshop.raw as Record<string, unknown>
                const jobId =
                  (typeof raw.jobId === 'string' && raw.jobId) ||
                  (typeof raw.job_id === 'string' && raw.job_id) ||
                  ''
                if (!jobId) {
                  throw new Error('No se encontró jobId para iniciar nueva versión')
                }
                await helper.startNewVersionFromJob(jobId)
                await tokens.refreshBalance()
                navigate('/helper')
              }}
              onSelect={(workshop) => {
                setSelectedWorkshop(workshop)
                navigate('/detail')
              }}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/detail"
        element={
          <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
            {selectedWorkshop ? (
              <WorkshopDetailScreen workshop={selectedWorkshop} onBack={() => navigate('/history')} />
            ) : (
              <Navigate to="/history" replace />
            )}
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
