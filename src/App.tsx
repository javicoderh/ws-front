import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AuthScreen } from './components/AuthScreen'
import { DashboardScreen } from './components/DashboardScreen'
import { GenerationStatusScreen } from './components/GenerationStatusScreen'
import { HelperStepperScreen } from './components/HelperStepperScreen'
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
import { getErrorCode } from './utils/backendErrors'
import { formatBackendError } from './utils/backendErrors'

type Screen =
  | 'auth'
  | 'profile'
  | 'dashboard'
  | 'tokens'
  | 'helper'
  | 'generation'
  | 'history'
  | 'detail'

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

function App() {
  const { request } = useApiClient()
  const auth = useAuth()
  const tokens = useTokens()
  const helper = useHelper()
  const workshops = useWorkshops()

  const [screen, setScreen] = useState<Screen>('auth')
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopRecord | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [dashboardNotice, setDashboardNotice] = useState<DashboardNotice>(null)
  const [pendingHelperSessionId, setPendingHelperSessionId] = useState<string | null>(null)

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
        setScreen('profile')
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
      setScreen('dashboard')
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
      setScreen('auth')
      helper.reset()
      setProfile(null)
      return
    }

    if (screen === 'auth') {
      void loadProfile()
        .then((p) => {
          if (p) {
            setScreen('dashboard')
            return tokens.refreshBalance()
          }
          return Promise.resolve()
        })
        .catch(() => {
          // Errors visible through context states.
        })
    }
  }, [auth.isAuthenticated, helper, screen, tokens]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
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
        setScreen('dashboard')
      })
      .catch(() => {
        // Error visible through tokens context.
      })
  }, [auth.isAuthenticated, tokens])

  useEffect(() => {
    if (screen !== 'generation' || !helper.jobId) {
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
  }, [helper, screen])

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
      setScreen('helper')
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
          setScreen('helper')
          return
        } catch {
          setDashboardNotice('no_credits')
          return
        }
        setDashboardNotice('no_credits')
        return
      }
      if (code === 'WORKSHOP_HELPER_FORBIDDEN') {
        auth.logout()
        helper.reset()
        setScreen('auth')
      }
    }
  }

  const handleFinalize = async () => {
    await helper.finalizeSession()
    await Promise.all([helper.loadJobStatus(), helper.loadQueueStatus()])
    setScreen('generation')
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        loading={auth.loading}
        error={auth.error}
        onLogin={auth.loginEmail}
        onSignup={auth.signupEmail}
        onGoogleLogin={auth.loginGoogle}
        onForgotPassword={auth.forgotPassword}
      />
    )
  }

  if (screen === 'profile') {
    return (
      <ProfileScreen
        profile={profile}
        loading={profileLoading}
        error={globalError}
        onSubmit={upsertProfile}
        onRefresh={async () => {
          await loadProfile()
        }}
        onBack={() => setScreen('dashboard')}
      />
    )
  }

  if (screen === 'dashboard') {
    return (
      <DashboardScreen
        balance={tokens.balance}
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
            setScreen('helper')
            return
          }
          if (dashboardNotice === 'no_credits') {
            setDashboardNotice(null)
            setScreen('tokens')
          }
        }}
        onNoticeSecondary={() => {
          setDashboardNotice(null)
          setPendingHelperSessionId(null)
        }}
        onGoPurchase={() => setScreen('tokens')}
        onGoProfile={() => {
          void loadProfile().then(() => setScreen('profile'))
        }}
        onGoHistory={() => {
          void Promise.all([workshops.loadHistory(), workshops.loadList()]).then(() => setScreen('history'))
        }}
        onChangePassword={async () => {
          const nextPassword = window.prompt('Nueva contrasena (min 6):')
          if (!nextPassword) return
          await auth.changePassword(nextPassword)
        }}
        onLogout={() => {
          auth.logout()
          helper.reset()
          setScreen('auth')
        }}
      />
    )
  }

  if (screen === 'tokens') {
    return (
      <TokenPurchaseScreen
        packs={tokens.packs}
        unitPriceClp={tokens.pricing?.unitPriceClp ?? null}
        unitPriceUsd={tokens.pricing?.unitPriceUsd ?? null}
        loading={tokens.loading}
        error={globalError}
        onBack={() => setScreen('dashboard')}
        onLoadPacks={tokens.loadTokenPacks}
        onLoadPricing={tokens.loadPricing}
        onLoadHistory={tokens.loadHistory}
        onLoadPurchaseHistory={tokens.loadPurchaseHistory}
        onStartCheckout={tokens.startCheckout}
        onConfirmCheckout={async () => {
          await tokens.confirmCheckout()
          await tokens.refreshBalance()
          setScreen('dashboard')
        }}
      />
    )
  }

  if (screen === 'helper') {
    return (
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
        onBack={() => setScreen('dashboard')}
      />
    )
  }

  if (screen === 'generation') {
    return (
      <GenerationStatusScreen
        jobId={helper.jobId}
        jobStatus={helper.jobStatus}
        queueStatus={helper.queueStatus}
        loading={helper.loading}
        error={globalError}
        onRefresh={async () => {
          await Promise.all([helper.loadJobStatus(), helper.loadQueueStatus(), helper.loadMetrics()])
        }}
        onBackDashboard={() => setScreen('dashboard')}
        onGoHistory={() => {
          void Promise.all([workshops.loadHistory(), workshops.loadList()]).then(() => setScreen('history'))
        }}
      />
    )
  }

  if (screen === 'history') {
    return (
      <WorkshopHistoryScreen
        history={[...workshops.history, ...workshops.list]}
        loading={workshops.loading}
        error={globalError}
        onBack={() => setScreen('dashboard')}
        onRefresh={async () => {
          await Promise.all([workshops.loadHistory(), workshops.loadList()])
        }}
        onSelect={(workshop) => {
          setSelectedWorkshop(workshop)
          setScreen('detail')
        }}
      />
    )
  }

  if (screen === 'detail' && selectedWorkshop) {
    return <WorkshopDetailScreen workshop={selectedWorkshop} onBack={() => setScreen('history')} />
  }

  return null
}

export default App
