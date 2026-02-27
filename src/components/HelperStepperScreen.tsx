import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Layout, ErrorBanner } from './Layout'
import type { HelperField, HelperState } from '../types/backend'

type Props = {
  helperState: HelperState | null
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  onAnswer: (stepId: string, answer: unknown) => Promise<void>
  onEditStep: (stepId: string) => Promise<void>
  onFinalize: () => Promise<void>
  onBack: () => void
}

type ManualInstrument = {
  type: 'actividad_con_rubrica' | 'instrumento_escrito'
  activityDescription: string
  totalQuestions: string
  multipleChoiceQuestions: string
  trueFalseQuestions: string
  essentialContents: string
}

const SESSION_COUNT_STORAGE_PREFIX = 'workshopia.helper.sessionCount.'
const MAX_SESSIONS_SUPPORTED = 8
const FALLBACK_MAX_ITEMS = MAX_SESSIONS_SUPPORTED * 2

type StringArrayUiConfig = {
  placeholder: string
  addButtonLabel: string
  itemsLabel: string
  maxWordsPerItem?: number
  maxItems?: number
  rulesHint?: string
  exampleHint?: string
}

function parseOptionalList(raw: string): string[] {
  return raw
    .split(/[;\n]/g)
    .map((x) => x.trim())
    .filter(Boolean)
}

function buildInstrumentTemplate(manual: ManualInstrument[], countNumber: number): string {
  const normalized = manual.slice(0, countNumber)
  const blocks = normalized.map((item, index) => {
    const title = `Instrumento ${index + 1}`
    const description = item.activityDescription.trim() || `Instrumento ${index + 1} del workshop`
    const imprescindibles = parseOptionalList(item.essentialContents)
    const imprescindiblesLine =
      imprescindibles.length > 0
        ? `preguntas imprescindibles: ${imprescindibles.join(' ; ')}`
        : ''

    if (item.type === 'actividad_con_rubrica') {
      return [
        title,
        `descripcion: ${description}`,
        'modalidad: actividad con rubrica',
        imprescindiblesLine,
      ]
        .filter(Boolean)
        .join('\n')
    }

    const total = Math.max(1, Number(item.totalQuestions) || 0)
    const alternatives = Math.max(0, Number(item.multipleChoiceQuestions) || 0)
    const trueFalse = Math.max(0, Number(item.trueFalseQuestions) || 0)
    const openQuestions = Math.max(0, total - alternatives - trueFalse)

    return [
      title,
      `descripcion: ${description}`,
      'modalidad: instrumento escrito',
      `preguntas totales: ${total}`,
      `preguntas alternativas: ${alternatives}`,
      `preguntas verdadero y falso: ${trueFalse}`,
      `preguntas abiertas: ${openQuestions}`,
      imprescindiblesLine,
    ]
      .filter(Boolean)
      .join('\n')
  })

  return blocks.join('\n\n')
}

function ensureManualCount(prev: ManualInstrument[], count: number): ManualInstrument[] {
  const next = [...prev]
  while (next.length < count) {
    next.push({
      type: 'actividad_con_rubrica',
      activityDescription: '',
      totalQuestions: '0',
      multipleChoiceQuestions: '0',
      trueFalseQuestions: '0',
      essentialContents: '',
    })
  }
  return next.slice(0, count)
}

function fieldKey(field: HelperField, index: number): string {
  return field.id || `field_${index}`
}

function toOption(option: { label: string; value: string }): { label: string; value: string } {
  return option
}

function coerceByType(field: HelperField, value: string): unknown {
  const type = field.valueType
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  if (type === 'multi_select') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (type === 'string_array') {
    return value
      .split(/\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value
}

function buildAnswer(fields: HelperField[], values: Record<string, string>): unknown {
  if (fields.length === 0) {
    return values.__single ?? ''
  }

  if (fields.length === 1) {
    const key = fieldKey(fields[0], 0)
    return coerceByType(fields[0], values[key] ?? '')
  }

  return fields.reduce<Record<string, unknown>>((acc, field, index) => {
    const key = fieldKey(field, index)
    acc[key] = coerceByType(field, values[key] ?? '')
    return acc
  }, {})
}

function initialValuesForFields(fields: HelperField[]): Record<string, string> {
  if (fields.length === 0) {
    return { __single: '' }
  }
  return fields.reduce<Record<string, string>>((acc, field, index) => {
    acc[fieldKey(field, index)] = ''
    return acc
  }, {})
}

function parseStringArrayValues(raw: string): string[] {
  return raw
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function sessionCountStorageKey(sessionId: string): string {
  return `${SESSION_COUNT_STORAGE_PREFIX}${sessionId}`
}

function readStoredSessionCount(sessionId: string): number | null {
  if (typeof window === 'undefined' || !sessionId.trim()) {
    return null
  }
  const raw = window.localStorage.getItem(sessionCountStorageKey(sessionId))
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function persistSessionCount(sessionId: string, count: number): void {
  if (typeof window === 'undefined' || !sessionId.trim() || !Number.isFinite(count) || count <= 0) {
    return
  }
  window.localStorage.setItem(sessionCountStorageKey(sessionId), String(Math.trunc(count)))
}

function stringArrayUiCopy(stepId: string, fieldId: string, sessionCount: number | null): StringArrayUiConfig {
  const maxItems = Math.max(1, (sessionCount ?? (FALLBACK_MAX_ITEMS / 2)) * 2)

  if (stepId === 'mandatory_activities' || fieldId === 'mandatory_activities') {
    return {
      placeholder: 'Agregar actividad obligatoria...',
      addButtonLabel: '+ Agregar actividad obligatoria',
      itemsLabel: 'Actividades obligatorias',
      maxWordsPerItem: 100,
      maxItems,
      rulesHint: 'Máximo 2 actividades obligatorias por sesión. Máximo 100 palabras por actividad.',
    }
  }

  if (stepId === 'consideraciones_dua' || fieldId === 'consideraciones_dua') {
    return {
      placeholder: 'Agregar consideración DUA...',
      addButtonLabel: '+ Agregar consideración DUA',
      itemsLabel: 'Consideraciones DUA',
      maxWordsPerItem: 50,
      maxItems,
      rulesHint: 'Máximo 2 consideraciones DUA por sesión. Máximo 50 palabras por consideración.',
    }
  }

  if (
    stepId === 'brochure_brief.learning_outcomes_client' ||
    fieldId === 'brochure_brief.learning_outcomes_client'
  ) {
    return {
      placeholder: 'Agregar resultado esperado...',
      addButtonLabel: '+ Agregar resultado esperado',
      itemsLabel: 'Resultados esperados',
      exampleHint:
        'Ejemplo: Aplicar una pauta DUA para planificar una clase inclusiva.',
    }
  }

  return {
    placeholder: 'Agregar elemento...',
    addButtonLabel: '+ Agregar consideración',
    itemsLabel: 'Items',
  }
}

function InstrumentWizard({ onSubmit, loading }: { onSubmit: (value: unknown) => Promise<void>; loading: boolean }) {
  const [mode, setMode] = useState<'automatico' | 'manual'>('automatico')
  const [count, setCount] = useState('1')
  const [manual, setManual] = useState<ManualInstrument[]>([])
  const [essentialDrafts, setEssentialDrafts] = useState<Record<number, string>>({})
  const [essentialErrors, setEssentialErrors] = useState<Record<number, string>>({})

  const countNumber = useMemo(() => Math.max(1, Number(count) || 1), [count])

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (mode === 'automatico') {
      await onSubmit('delegar automatico\npreferencia: balanceado')
      return
    }

    await onSubmit(buildInstrumentTemplate(manual, countNumber))
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Modo de definicion
        <select
          value={mode}
          onChange={(e) => {
            const nextMode = e.target.value as 'automatico' | 'manual'
            setMode(nextMode)
            if (nextMode === 'manual') {
              setManual((prev) => ensureManualCount(prev, countNumber))
            }
          }}
        >
          <option value="automatico">automatico</option>
          <option value="manual">manual</option>
        </select>
      </label>

      <label>
        Cantidad de instrumentos
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => {
            const nextRaw = e.target.value
            setCount(nextRaw)
            if (mode === 'manual') {
              const nextCount = Math.max(1, Number(nextRaw) || 1)
              setManual((prev) => ensureManualCount(prev, nextCount))
            }
          }}
        />
      </label>

      {mode === 'manual'
        ? manual.map((instrument, index) => (
            <article className="card" key={`instrument-${index.toString()}`}>
              <h3>Instrumento {index + 1}</h3>
              <label>
                Tipo
                <select
                  value={instrument.type}
                  onChange={(e) => {
                    const type = e.target.value as 'actividad_con_rubrica' | 'instrumento_escrito'
                    setManual((prev) => {
                      const next = [...prev]
                      next[index] = { ...next[index], type }
                      return next
                    })
                  }}
                >
                  <option value="actividad_con_rubrica">actividad_con_rubrica</option>
                  <option value="instrumento_escrito">instrumento_escrito</option>
                </select>
              </label>

              {instrument.type === 'actividad_con_rubrica' ? (
                <label>
                  Descripcion de actividad
                  <textarea
                    value={instrument.activityDescription}
                    onChange={(e) => {
                      const value = e.target.value
                      setManual((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], activityDescription: value }
                        return next
                      })
                    }}
                  />
                </label>
              ) : (
                <>
                  <label>
                    Preguntas totales
                    <input
                      type="number"
                      min={0}
                      value={instrument.totalQuestions}
                      onChange={(e) => {
                        const value = e.target.value
                        setManual((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], totalQuestions: value }
                          return next
                        })
                      }}
                    />
                  </label>
                  <label>
                    Preguntas alternativas
                    <input
                      type="number"
                      min={0}
                      value={instrument.multipleChoiceQuestions}
                      onChange={(e) => {
                        const value = e.target.value
                        setManual((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], multipleChoiceQuestions: value }
                          return next
                        })
                      }}
                    />
                  </label>
                  <label>
                    Preguntas verdadero/falso
                    <input
                      type="number"
                      min={0}
                      value={instrument.trueFalseQuestions}
                      onChange={(e) => {
                        const value = e.target.value
                        setManual((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], trueFalseQuestions: value }
                          return next
                        })
                      }}
                    />
                  </label>
                </>
              )}

              <label>
                Contenidos imprescindibles a evaluar (opcional)
                <div className="string-array-builder">
                  <div className="row">
                    <input
                      type="text"
                      value={essentialDrafts[index] ?? ''}
                      placeholder="Agregar contenido imprescindible..."
                      onChange={(e) => {
                        const value = e.target.value
                        setEssentialDrafts((prev) => ({ ...prev, [index]: value }))
                        if (essentialErrors[index]) {
                          setEssentialErrors((prev) => ({ ...prev, [index]: '' }))
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') {
                          return
                        }
                        e.preventDefault()
                        const draft = (essentialDrafts[index] ?? '').trim()
                        if (!draft) {
                          return
                        }
                        const words = countWords(draft)
                        if (words > 30) {
                          setEssentialErrors((prev) => ({
                            ...prev,
                            [index]: `Cada contenido imprescindible admite máximo 30 palabras (actual: ${words}).`,
                          }))
                          return
                        }
                        const currentItems = parseOptionalList(instrument.essentialContents)
                        const nextItems = [...currentItems, draft]
                        setManual((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], essentialContents: nextItems.join('\n') }
                          return next
                        })
                        setEssentialDrafts((prev) => ({ ...prev, [index]: '' }))
                        setEssentialErrors((prev) => ({ ...prev, [index]: '' }))
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const draft = (essentialDrafts[index] ?? '').trim()
                        if (!draft) {
                          return
                        }
                        const words = countWords(draft)
                        if (words > 30) {
                          setEssentialErrors((prev) => ({
                            ...prev,
                            [index]: `Cada contenido imprescindible admite máximo 30 palabras (actual: ${words}).`,
                          }))
                          return
                        }
                        const currentItems = parseOptionalList(instrument.essentialContents)
                        const nextItems = [...currentItems, draft]
                        setManual((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], essentialContents: nextItems.join('\n') }
                          return next
                        })
                        setEssentialDrafts((prev) => ({ ...prev, [index]: '' }))
                        setEssentialErrors((prev) => ({ ...prev, [index]: '' }))
                      }}
                    >
                      + Agregar contenido imprescindible
                    </button>
                  </div>
                  <p className="hint">
                    Máximo 30 palabras por contenido imprescindible.
                  </p>
                  <ErrorBanner message={essentialErrors[index] ?? null} />
                  {parseOptionalList(instrument.essentialContents).length > 0 ? (
                    <div className="string-array-items">
                      {parseOptionalList(instrument.essentialContents).map((item, itemIndex) => (
                        <div className="string-array-item" key={`inst-${index}-essential-${itemIndex.toString()}`}>
                          <span>{item}</span>
                          <button
                            type="button"
                            className="landing-ghost-button"
                            onClick={() => {
                              const currentItems = parseOptionalList(instrument.essentialContents)
                              const nextItems = currentItems.filter((_, idx) => idx !== itemIndex)
                              setManual((prev) => {
                                const next = [...prev]
                                next[index] = {
                                  ...next[index],
                                  essentialContents: nextItems.join('\n'),
                                }
                                return next
                              })
                              setEssentialErrors((prev) => ({ ...prev, [index]: '' }))
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
            </article>
          ))
        : null}

      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Guardar respuesta step'}
      </button>
    </form>
  )
}

export function HelperStepperScreen({
  helperState,
  loading,
  error,
  onRefresh,
  onAnswer,
  onEditStep,
  onFinalize,
  onBack,
}: Props) {
  const stepId = helperState?.currentStepId ?? ''
  const fields = useMemo(() => helperState?.fields ?? [], [helperState])
  const editableSteps = useMemo(() => {
    const steps = helperState?.steps ?? []
    const unique = new Set<string>()
    for (const step of steps) {
      if (step.stepId.trim()) {
        unique.add(step.stepId)
      }
    }
    return Array.from(unique)
  }, [helperState])
  const suggestions = helperState?.suggestions ?? []
  const hasSuggestionOptions = suggestions.length > 0 && fields.length <= 1
  const fieldStateKey = useMemo(
    () => `${stepId}::${fields.map((field, index) => fieldKey(field, index)).join('|')}`,
    [fields, stepId],
  )
  const [valueState, setValueState] = useState<{
    key: string
    values: Record<string, string>
  }>({
    key: '',
    values: { __single: '' },
  })
  const formValues =
    valueState.key === fieldStateKey ? valueState.values : initialValuesForFields(fields)
  const [stepToEdit, setStepToEdit] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState('')
  const [stringArrayDrafts, setStringArrayDrafts] = useState<Record<string, string>>({})
  const [stringArrayErrors, setStringArrayErrors] = useState<Record<string, string>>({})
  const [optionalFieldChoices, setOptionalFieldChoices] = useState<Record<string, 'yes' | 'no'>>({})
  const selectedEditableStep =
    stepToEdit && editableSteps.includes(stepToEdit) ? stepToEdit : (editableSteps[0] ?? '')
  const sessionId = helperState?.sessionId ?? ''
  const sessionCount = useMemo(() => readStoredSessionCount(sessionId), [sessionId])
  const setFormValues = (
    updater:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => {
    setValueState((prev) => {
      const base = prev.key === fieldStateKey ? prev.values : initialValuesForFields(fields)
      const nextValues = typeof updater === 'function' ? updater(base) : updater
      return {
        key: fieldStateKey,
        values: nextValues,
      }
    })
  }

  const selectedSuggestionValue = suggestions.includes(selectedSuggestion)
    ? selectedSuggestion
    : ''

  const submitGeneric = async (event: FormEvent) => {
    event.preventDefault()
    if (!stepId) {
      return
    }
    if (hasSuggestionOptions) {
      if (!selectedSuggestionValue) {
        return
      }
      const fieldType = fields[0]?.valueType
      const retryAnswer =
        fieldType === 'string_array' || fieldType === 'multi_select'
          ? [selectedSuggestionValue]
          : selectedSuggestionValue
      await onAnswer(stepId, retryAnswer)
      return
    }
    const answer = buildAnswer(fields, formValues)
    if (stepId === 'numero_de_sesiones') {
      const parsed = typeof answer === 'number' ? answer : Number(answer)
      if (Number.isFinite(parsed) && parsed >= 1) {
        persistSessionCount(sessionId, parsed)
      }
    }
    await onAnswer(stepId, answer)
  }

  const canFinalize = helperState?.canFinalize === true
  const isInstrumentStep = stepId === 'instrumentos_de_evaluacion_requeridos'

  return (
    <Layout
      title="Helper stepper"
      subtitle="Render dinamico desde currentStepId/prompt/fields"
      actions={
        <div className="row">
          <button type="button" onClick={onBack}>
            Salir
          </button>
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            Refrescar step
          </button>
        </div>
      }
    >
      <section className="section stack">
        <p className="pill">Estado: {helperState?.status ?? 'sin estado'}</p>
        <h2>{stepId || 'Sin step activo'}</h2>
        <p>
          {isInstrumentStep
            ? 'Define instrumentos usando el formato guiado. Si dejas contenidos imprescindibles vacio, se asume que no hay contenidos obligatorios especificos.'
            : helperState?.prompt ?? 'Sin prompt disponible.'}
        </p>

        {isInstrumentStep ? (
          <article className="card stack">
            <h3>Formato recomendado</h3>
            <pre>{`Instrumento 1
descripcion: Evaluacion de cierre del modulo
modalidad: instrumento escrito
preguntas totales: 10
preguntas alternativas: 5
preguntas verdadero y falso: 3
preguntas abiertas: 2
preguntas imprescindibles: Aplicar transferencia de fuerza ; Justificar decisiones tecnicas`}</pre>
            <p className="hint">
              `preguntas imprescindibles` es opcional. Si no tienes algo que deba evaluarse si o si, dejalo vacio.
            </p>
          </article>
        ) : null}

        {helperState?.feedback ? <p className="hint">Feedback: {helperState.feedback}</p> : null}

        {helperState?.suggestions && helperState.suggestions.length > 0 ? (
          <article className="card">
            <h3>Sugerencias</h3>
            {helperState.suggestions.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
        ) : null}

        {isInstrumentStep ? (
          <InstrumentWizard onSubmit={(value) => onAnswer(stepId, value)} loading={loading} />
        ) : canFinalize ? (
          <div className="stack">
            <button
              type="button"
              onClick={() => void onFinalize()}
              disabled={loading}
            >
              {loading ? 'Generando...' : 'Generar workshop'}
            </button>

            <label>
              Volver a editar step
              <select value={selectedEditableStep} onChange={(e) => setStepToEdit(e.target.value)}>
                {editableSteps.map((step) => (
                  <option key={step} value={step}>
                    {step}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void onEditStep(selectedEditableStep)}
              disabled={loading || !selectedEditableStep}
            >
              Editar step seleccionado
            </button>
          </div>
        ) : (
          <form className="stack" onSubmit={submitGeneric}>
            {hasSuggestionOptions ? (
              <label>
                Elige una opcion sugerida
                <select
                  required
                  value={selectedSuggestionValue}
                  onChange={(e) => setSelectedSuggestion(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {suggestions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            ) : fields.length === 0 ? (
              <label>
                Respuesta
                <textarea
                  value={formValues.__single ?? ''}
                  onChange={(e) => setFormValues({ __single: e.target.value })}
                  required
                />
              </label>
            ) : (
              fields.map((field, index) => {
                const key = fieldKey(field, index)
                const type = field.valueType
                const label = field.label
                const options = Array.isArray(field.options) ? field.options.map(toOption) : []
                const isInstagramOptionalField =
                  stepId === 'brochure_brief.provider.contact.instagram' &&
                  field.id === 'brochure_brief.provider.contact.instagram'
                const isWebsiteOptionalField =
                  stepId === 'brochure_brief.provider.contact.website' &&
                  field.id === 'brochure_brief.provider.contact.website'

                if (type === 'select' && options.length > 0) {
                  return (
                    <label key={key}>
                      {label}
                      <select
                        required={field.required}
                        value={formValues[key] ?? ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccionar...</option>
                        {options.map((option) => (
                          <option key={`${key}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                }

                if (type === 'multi_select' && options.length > 0) {
                  const selected = (formValues[key] ?? '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                  const selectedSet = new Set(selected)
                  return (
                    <label key={key}>
                      {label}
                      <p className="hint">Seleccionados: {selected.length}</p>
                      <div className="multi-select-options" role="group" aria-label={label}>
                        {options.map((option) => {
                          const checked = selectedSet.has(option.value)
                          return (
                            <label key={`${key}-${option.value}`} className="multi-select-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? selected.filter((value) => value !== option.value)
                                    : [...selected, option.value]
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [key]: next.join(','),
                                  }))
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                      <div className="row">
                        <button
                          type="button"
                          className="landing-ghost-button"
                          disabled={selected.length === 0}
                          onClick={() =>
                            setFormValues((prev) => ({
                              ...prev,
                              [key]: '',
                            }))
                          }
                        >
                          Limpiar selección
                        </button>
                      </div>
                    </label>
                  )
                }

                if (type === 'boolean') {
                  const selectedValue = formValues[key] ?? ''
                  return (
                    <label key={key}>
                      {label}
                      <div className="boolean-toggle-group" role="group" aria-label={label}>
                        <button
                          type="button"
                          className={`boolean-toggle-button ${selectedValue === 'true' ? 'is-active' : ''}`}
                          onClick={() =>
                            setFormValues((prev) => ({
                              ...prev,
                              [key]: 'true',
                            }))
                          }
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={`boolean-toggle-button ${selectedValue === 'false' ? 'is-active' : ''}`}
                          onClick={() =>
                            setFormValues((prev) => ({
                              ...prev,
                              [key]: 'false',
                            }))
                          }
                        >
                          No
                        </button>
                      </div>
                    </label>
                  )
                }

                if (type === 'string_array' || (type === 'text' && (field.maxLen ?? 0) > 120)) {
                  if (type === 'string_array') {
                    const items = parseStringArrayValues(formValues[key] ?? '')
                    const draft = stringArrayDrafts[key] ?? ''
                    const uiCopy = stringArrayUiCopy(stepId, field.id, sessionCount)
                    const currentError = stringArrayErrors[key] ?? null
                    const canAddMore = !uiCopy.maxItems || items.length < uiCopy.maxItems
                    const addItem = () => {
                      const nextValue = draft.trim()
                      if (!nextValue) {
                        return
                      }
                      if (uiCopy.maxItems && items.length >= uiCopy.maxItems) {
                        setStringArrayErrors((prev) => ({
                          ...prev,
                          [key]: `Llegaste al máximo de ${uiCopy.maxItems} elementos.`,
                        }))
                        return
                      }
                      if (uiCopy.maxWordsPerItem) {
                        const words = countWords(nextValue)
                        if (words > uiCopy.maxWordsPerItem) {
                          setStringArrayErrors((prev) => ({
                            ...prev,
                            [key]: `Cada elemento admite máximo ${uiCopy.maxWordsPerItem} palabras (actual: ${words}).`,
                          }))
                          return
                        }
                      }
                      const nextItems = [...items, nextValue]
                      setFormValues((prev) => ({
                        ...prev,
                        [key]: nextItems.join('\n'),
                      }))
                      setStringArrayDrafts((prev) => ({
                        ...prev,
                        [key]: '',
                      }))
                      setStringArrayErrors((prev) => ({
                        ...prev,
                        [key]: '',
                      }))
                    }

                    return (
                      <label key={key}>
                        {label}
                        <div className="string-array-builder">
                          <div className="row">
                            <input
                              type="text"
                              value={draft}
                              placeholder={uiCopy.placeholder}
                              onChange={(e) =>
                                {
                                  setStringArrayDrafts((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                  if (currentError) {
                                    setStringArrayErrors((prev) => ({
                                      ...prev,
                                      [key]: '',
                                    }))
                                  }
                                }
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  addItem()
                                }
                              }}
                            />
                            <button type="button" onClick={addItem} disabled={!canAddMore}>
                              {uiCopy.addButtonLabel}
                            </button>
                          </div>
                          <p className="hint">
                            {uiCopy.itemsLabel}:{' '}
                            {uiCopy.maxItems ? `${items.length}/${uiCopy.maxItems}` : items.length}
                          </p>
                          {uiCopy.rulesHint ? <p className="hint">{uiCopy.rulesHint}</p> : null}
                          {uiCopy.exampleHint ? <p className="hint">{uiCopy.exampleHint}</p> : null}
                          <ErrorBanner message={currentError} />
                          {items.length > 0 ? (
                            <div className="string-array-items">
                              {items.map((item, itemIndex) => (
                                <div className="string-array-item" key={`${key}-item-${itemIndex.toString()}`}>
                                  <span>{item}</span>
                                  <button
                                    type="button"
                                    className="landing-ghost-button"
                                    onClick={() => {
                                      const nextItems = items.filter((_, idx) => idx !== itemIndex)
                                      setFormValues((prev) => ({
                                        ...prev,
                                        [key]: nextItems.join('\n'),
                                      }))
                                      setStringArrayErrors((prev) => ({
                                        ...prev,
                                        [key]: '',
                                      }))
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    )
                  }

                  return (
                    <label key={key}>
                      {label}
                      <textarea
                        value={formValues[key] ?? ''}
                        required={field.required}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  )
                }

                if (isInstagramOptionalField || isWebsiteOptionalField) {
                  const rawValue = formValues[key] ?? ''
                  const selectedChoice =
                    optionalFieldChoices[key] ??
                    (rawValue.trim().toUpperCase() === 'NO' ? 'no' : rawValue.trim() ? 'yes' : 'no')
                  const showInput = selectedChoice === 'yes'
                  const inputType = isWebsiteOptionalField ? 'url' : 'text'
                  const inputPlaceholder = isWebsiteOptionalField
                    ? 'https://tu-sitio.com'
                    : '@usuario o enlace de Instagram'

                  return (
                    <label key={key}>
                      {label}
                      <div className="boolean-toggle-group" role="group" aria-label={label}>
                        <button
                          type="button"
                          className={`boolean-toggle-button ${selectedChoice === 'yes' ? 'is-active' : ''}`}
                          onClick={() => {
                            setOptionalFieldChoices((prev) => ({ ...prev, [key]: 'yes' }))
                            if ((formValues[key] ?? '').trim().toUpperCase() === 'NO') {
                              setFormValues((prev) => ({
                                ...prev,
                                [key]: '',
                              }))
                            }
                          }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className={`boolean-toggle-button ${selectedChoice === 'no' ? 'is-active' : ''}`}
                          onClick={() => {
                            setOptionalFieldChoices((prev) => ({ ...prev, [key]: 'no' }))
                            setFormValues((prev) => ({
                              ...prev,
                              [key]: 'NO',
                            }))
                          }}
                        >
                          No
                        </button>
                      </div>
                      {showInput ? (
                        <input
                          type={inputType}
                          value={rawValue.trim().toUpperCase() === 'NO' ? '' : rawValue}
                          required
                          minLength={field.minLen}
                          maxLength={field.maxLen}
                          placeholder={inputPlaceholder}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <p className="hint">Se omitirá Instagram en el documento informativo PDF.</p>
                      )}
                    </label>
                  )
                }

                return (
                  <label key={key}>
                    {label}
                    <input
                      type={
                        type === 'number'
                          ? 'number'
                          : type === 'email'
                            ? 'email'
                            : type === 'url'
                              ? 'url'
                              : type === 'phone'
                                ? 'tel'
                                : 'text'
                      }
                      value={formValues[key] ?? ''}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      minLength={field.minLen}
                      maxLength={field.maxLen}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </label>
                )
              })
            )}

            <button type="submit" disabled={loading || !stepId}>
              {loading ? 'Enviando...' : 'Guardar y avanzar'}
            </button>
          </form>
        )}

        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
