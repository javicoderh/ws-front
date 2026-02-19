import type { GenericRecord, WorkshopRecord } from '../types/backend'

export type WorkshopSummary = {
  title: string
  description?: string
  sessions?: number
  durationMinutes?: number
  targetAudience?: string
  mainObjective?: string
  format?: string
  deliveryModes: string[]
  createdAtEpoch?: number
}

function asRecord(payload: unknown): GenericRecord {
  return typeof payload === 'object' && payload !== null ? (payload as GenericRecord) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function getWorkshopInput(raw: GenericRecord): GenericRecord {
  const direct = asRecord(raw.workshopInput)
  if (Object.keys(direct).length > 0) {
    return direct
  }
  const payload = asRecord(raw.payload)
  const payloadInput = asRecord(payload.workshopInput)
  if (Object.keys(payloadInput).length > 0) {
    return payloadInput
  }
  const inputSnapshot = asRecord(raw.inputSnapshot)
  const snapshotInput = asRecord(inputSnapshot.workshopInput)
  if (Object.keys(snapshotInput).length > 0) {
    return snapshotInput
  }
  return {}
}

function getDeliveryModes(raw: GenericRecord): string[] {
  const direct = asStringArray(raw.deliveryModes)
  if (direct.length > 0) {
    return direct
  }
  const payload = asRecord(raw.payload)
  const payloadModes = asStringArray(payload.deliveryModes)
  if (payloadModes.length > 0) {
    return payloadModes
  }
  const inputSnapshot = asRecord(raw.inputSnapshot)
  return asStringArray(inputSnapshot.deliveryModes)
}

export function buildWorkshopSummary(item: WorkshopRecord): WorkshopSummary {
  const raw = asRecord(item.raw)
  const input = getWorkshopInput(raw)
  const brochure = asRecord(input.brochureBrief)

  return {
    title:
      asString(input.workshopNombre) ??
      asString(raw.workshopName) ??
      asString(raw.title) ??
      item.title,
    description:
      asString(input.workshopDescripcion) ??
      asString(raw.workshopDescription) ??
      asString(brochure.valueProposition) ??
      asString(brochure.oneLiner),
    sessions: asNumber(input.numeroDeSesiones),
    durationMinutes: asNumber(input.duracionSesionMinutos),
    targetAudience: asString(input.descripcionPublicoObjetivo),
    mainObjective: asString(input.objetivoPrincipal),
    format: asString(brochure.format),
    deliveryModes: getDeliveryModes(raw),
    createdAtEpoch: item.updatedAtEpoch ?? item.createdAtEpoch,
  }
}

export function formatEpoch(epoch?: number): string | null {
  if (!epoch || !Number.isFinite(epoch)) {
    return null
  }
  const date = new Date(epoch * 1000)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
