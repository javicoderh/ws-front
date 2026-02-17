import { useEffect, useMemo, useState } from 'react'
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

const KNOWN_STEPS = [
  'workshop_nombre',
  'nivel_workshop',
  'workshop_descripcion',
  'objetivo_principal',
  'objetivos_secundarios',
  'numero_de_sesiones',
  'duracion_sesion_minutos',
  'descripcion_publico_objetivo',
  'prerequisitos',
  'oat_alignment.required',
  'oat_alignment.levels',
  'consideraciones_dua.required',
  'consideraciones_dua',
  'mandatory_activities',
  'numero_de_evaluaciones_requeridas',
  'instrumentos_de_evaluacion_requeridos',
  'delivery_modes',
  'brochure_brief.one_liner',
  'brochure_brief.value_proposition',
  'brochure_brief.format',
  'brochure_brief.learning_outcomes_client',
  'brochure_brief.cta.label',
  'brochure_brief.cta.action',
  'brochure_brief.cta.action_email_confirmed',
  'brochure_brief.provider.name',
  'brochure_brief.provider.contact.email',
  'brochure_brief.provider.contact.email_confirmed',
  'brochure_brief.provider.contact.phone',
  'brochure_brief.provider.contact.instagram',
  'brochure_brief.provider.contact.website',
  'email_delivery.recipient_email',
  'email_delivery.recipient_email_confirmed',
  'email_delivery.subject',
  'email_delivery.body',
]

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
      .split(/\\n|,/g)
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

function InstrumentWizard({ onSubmit, loading }: { onSubmit: (value: unknown) => Promise<void>; loading: boolean }) {
  const [mode, setMode] = useState<'automatico' | 'manual'>('automatico')
  const [count, setCount] = useState('1')
  const [manual, setManual] = useState<ManualInstrument[]>([])

  const countNumber = useMemo(() => Math.max(1, Number(count) || 1), [count])

  useEffect(() => {
    if (mode !== 'manual') {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual((prev) => {
      const next = [...prev]
      while (next.length < countNumber) {
        next.push({
          type: 'actividad_con_rubrica',
          activityDescription: '',
          totalQuestions: '0',
          multipleChoiceQuestions: '0',
          trueFalseQuestions: '0',
          essentialContents: '',
        })
      }
      return next.slice(0, countNumber)
    })
  }, [countNumber, mode])

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (mode === 'automatico') {
      await onSubmit({
        mode,
        instrumentCount: countNumber,
      })
      return
    }

    const instruments = manual.map((item) => {
      if (item.type === 'actividad_con_rubrica') {
        return {
          type: item.type,
          activityDescription: item.activityDescription,
          essentialContents: item.essentialContents
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        }
      }

      const total = Number(item.totalQuestions) || 0
      const alternatives = Number(item.multipleChoiceQuestions) || 0
      const trueFalse = Number(item.trueFalseQuestions) || 0
      const openQuestions = Math.max(0, total - alternatives - trueFalse)

      return {
        type: item.type,
        totalQuestions: total,
        multipleChoiceQuestions: alternatives,
        trueFalseQuestions: trueFalse,
        openQuestions,
        essentialContents: item.essentialContents
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      }
    })

    await onSubmit({
      mode,
      instrumentCount: countNumber,
      instruments,
    })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Modo de definicion
        <select value={mode} onChange={(e) => setMode(e.target.value as 'automatico' | 'manual')}>
          <option value="automatico">automatico</option>
          <option value="manual">manual</option>
        </select>
      </label>

      <label>
        Cantidad de instrumentos
        <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
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
                Contenidos imprescindibles (coma separada)
                <textarea
                  value={instrument.essentialContents}
                  onChange={(e) => {
                    const value = e.target.value
                    setManual((prev) => {
                      const next = [...prev]
                      next[index] = { ...next[index], essentialContents: value }
                      return next
                    })
                  }}
                  placeholder="opcional en automatico, recomendado en manual"
                />
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
  const suggestions = helperState?.suggestions ?? []
  const hasSuggestionOptions = suggestions.length > 0 && fields.length <= 1
  const [values, setValues] = useState<Record<string, string>>({ __single: '' })
  const [stepToEdit, setStepToEdit] = useState('workshop_nombre')
  const [selectedSuggestion, setSelectedSuggestion] = useState('')

  useEffect(() => {
    if (!helperState) {
      return
    }

    if (fields.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues({ __single: '' })
      return
    }

    const next = fields.reduce<Record<string, string>>((acc, field, index) => {
      acc[fieldKey(field, index)] = ''
      return acc
    }, {})
    setValues(next)
  }, [fields, helperState])

  useEffect(() => {
    setSelectedSuggestion('')
  }, [stepId])

  const submitGeneric = async (event: FormEvent) => {
    event.preventDefault()
    if (!stepId) {
      return
    }
    if (hasSuggestionOptions) {
      if (!selectedSuggestion) {
        return
      }
      const fieldType = fields[0]?.valueType
      const retryAnswer =
        fieldType === 'string_array' || fieldType === 'multi_select'
          ? [selectedSuggestion]
          : selectedSuggestion
      await onAnswer(stepId, retryAnswer)
      return
    }
    await onAnswer(stepId, buildAnswer(fields, values))
  }

  const isReview = stepId === 'review'
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
        <p>{helperState?.prompt ?? 'Sin prompt disponible.'}</p>

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
        ) : isReview ? (
          <div className="stack">
            <button
              type="button"
              onClick={() => void onFinalize()}
              disabled={loading || !helperState?.canFinalize}
            >
              {loading ? 'Generando...' : 'Generar workshop'}
            </button>

            <label>
              Volver a editar step
              <select value={stepToEdit} onChange={(e) => setStepToEdit(e.target.value)}>
                {KNOWN_STEPS.map((step) => (
                  <option key={step} value={step}>
                    {step}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void onEditStep(stepToEdit)} disabled={loading}>
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
                  value={selectedSuggestion}
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
                  value={values.__single ?? ''}
                  onChange={(e) => setValues({ __single: e.target.value })}
                  required
                />
              </label>
            ) : (
              fields.map((field, index) => {
                const key = fieldKey(field, index)
                const type = field.valueType
                const label = field.label
                const options = Array.isArray(field.options) ? field.options.map(toOption) : []

                if (type === 'select' && options.length > 0) {
                  return (
                    <label key={key}>
                      {label}
                      <select
                        required={field.required}
                        value={values[key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({
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
                  const selected = (values[key] ?? '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                  return (
                    <label key={key}>
                      {label}
                      <select
                        multiple
                        required={field.required}
                        value={selected}
                        onChange={(e) => {
                          const next = Array.from(e.currentTarget.selectedOptions).map(
                            (option) => option.value,
                          )
                          setValues((prev) => ({
                            ...prev,
                            [key]: next.join(','),
                          }))
                        }}
                      >
                        {options.map((option) => (
                          <option key={`${key}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                }

                if (type === 'boolean') {
                  return (
                    <label key={key}>
                      {label}
                      <select
                        required={field.required}
                        value={values[key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccionar...</option>
                        <option value="true">Si</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  )
                }

                if (type === 'string_array' || (type === 'text' && (field.maxLen ?? 0) > 120)) {
                  return (
                    <label key={key}>
                      {label}
                      <textarea
                        value={values[key] ?? ''}
                        required={field.required}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
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
                      value={values[key] ?? ''}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      minLength={field.minLen}
                      maxLength={field.maxLen}
                      onChange={(e) =>
                        setValues((prev) => ({
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
