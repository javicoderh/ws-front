export type ApiError = {
  code?: string
  message: string
  status?: number
}

export type GenericRecord = Record<string, unknown>

export type AuthUser = {
  uid: string
  email: string
  displayName?: string
  provider?: string
}

export type Profile = {
  uid: string
  email: string
  username: string
  displayName: string
  phoneE164: string
  whatsappCountryCode: string
  countryOfResidence: string
  profileImageUrl: string
  credential?: string
  workshopTokensBalance: number
  createdAtEpoch?: number
  updatedAtEpoch?: number
}

export type WorkshopTokenPricing = {
  unitPriceUsd: number
  unitPriceClp: number
}

export type WorkshopTokenTransaction = {
  transactionId: string
  uid: string
  tokens: number
  movementType?: string
  source: string
  referenceId: string
  idempotencyKey: string
  unitPriceUsd: number
  unitPriceClp: number
  amountPaidUsd: number
  amountPaidClp: number
  balanceAfterTokens: number
  createdAtEpoch: number
}

export type TokenPurchaseRecord = {
  purchaseId: string
  uid: string
  provider: string
  providerPaymentId: string
  paymentSessionId: string
  packId: string
  tokens: number
  amountClp: number
  currency: string
  status: string
  createdAtEpoch: number
}

export type TokenPurchaseHistory = {
  purchases: TokenPurchaseRecord[]
  totalPurchases: number
  totalTokensPurchased: number
  totalAmountClp: number
}

export type TokenPack = {
  packId: string
  tokens: number
  priceClp: number
  label: string
}

export type PaymentSession = {
  paymentSessionId: string
  uid: string
  packId: string
  tokens: number
  amountClp: number
  checkoutUrl?: string
  providerPreferenceId?: string
  providerPaymentId?: string
  status: 'pending' | 'paid' | 'cancelled' | string
  createdAtEpoch: number
  updatedAtEpoch: number
}

export type StartCheckoutResult = {
  paymentSession: PaymentSession
  packs: TokenPack[]
  checkoutUrl: string
}

export type ConfirmCheckoutResult = {
  paymentSession: PaymentSession
  workshopTokensBalance: number
}

export type HelperStatus =
  | 'in_progress'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'escalated'
  | 'finished'

export type HelperStepStatus =
  | 'pending'
  | 'in_progress'
  | 'validating'
  | 'needs_retry'
  | 'validated'
  | 'blocked'
  | 'escalated'

export type HelperFieldValueType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'email'
  | 'phone'
  | 'url'
  | 'string_array'
  | string

export type HelperOption = {
  value: string
  label: string
}

export type HelperField = {
  id: string
  label: string
  required: boolean
  valueType?: HelperFieldValueType
  minLen?: number
  maxLen?: number
  min?: number
  max?: number
  options?: HelperOption[]
  voiceMaxSeconds?: number
  help?: string
}

export type HelperStep = {
  stepId: string
  title: string
  prompt: string
  stepType: string
  status: HelperStepStatus | string
  attempt: number
  maxAttempts: number
  fields: HelperField[]
  feedback?: string
  suggestions: string[]
}

export type HelperState = {
  sessionId: string
  mode?: string
  status: HelperStatus | string
  currentStepId: string
  currentStepType?: string
  attempt: number
  maxAttempts: number
  prompt: string
  fields: HelperField[]
  feedback?: string
  suggestions: string[]
  steps: HelperStep[]
  canFinalize: boolean
  raw: GenericRecord
}

export type QueueAheadItem = {
  jobId: string
  workshopName: string
}

export type WorkshopJobRecord = {
  jobId: string
  workshopId: string
  helperSessionId: string
  uid?: string
  workshopName: string
  status: string
  createdAtEpoch: number
  startedAtEpoch?: number
  finishedAtEpoch?: number
  error?: string
  inputSnapshot?: unknown
  payload?: unknown
  raw: GenericRecord
}

export type JobStatus = {
  job: WorkshopJobRecord
  runningCount: number
  maxParallel: number
  queuePosition?: number
  jobsAhead: QueueAheadItem[]
  etaMinutes?: number
  raw: GenericRecord
}

export type QueueItem = {
  jobId: string
  workshopName: string
  status: string
  createdAtEpoch: number
}

export type QueueStatus = {
  runningCount: number
  maxParallel: number
  queuedCount: number
  etaPerWorkshopMinutes: number
  etaSafetyFactor: number
  running: QueueItem[]
  waitingQueue: QueueItem[]
  raw: GenericRecord
}

export type WorkshopRecord = {
  id: string
  title: string
  status?: string
  createdAtEpoch?: number
  updatedAtEpoch?: number
  raw: GenericRecord
}

export type HelperMetrics = {
  sessionId: string
  status: string
  inputFulfilled: boolean
  openaiRequests: number
  openaiPromptTokens: number
  openaiCompletionTokens: number
  openaiTotalTokens: number
  openaiCostUsd: number
}
