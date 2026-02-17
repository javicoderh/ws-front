import { useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorBanner, Layout } from './Layout'
import type { Profile } from '../types/backend'

type ProfileDraft = {
  username: string
  displayName: string
  phoneE164: string
  whatsappCountryCode: string
  countryOfResidence: string
  profileImageUrl: string
}

type Props = {
  profile: Profile | null
  loading: boolean
  error: string | null
  onSubmit: (draft: ProfileDraft) => Promise<void>
  onRefresh: () => Promise<void>
  onBack: () => void
}

export function ProfileScreen({ profile, loading, error, onSubmit, onRefresh, onBack }: Props) {
  const [draft, setDraft] = useState<ProfileDraft>({
    username: profile?.username ?? '',
    displayName: profile?.displayName ?? '',
    phoneE164: profile?.phoneE164 ?? '',
    whatsappCountryCode: profile?.whatsappCountryCode ?? '+56',
    countryOfResidence: profile?.countryOfResidence ?? 'Chile',
    profileImageUrl: profile?.profileImageUrl ?? 'https://placehold.co/200x200/png',
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onSubmit(draft)
  }

  return (
    <Layout
      title="Perfil de usuario"
      subtitle="Este perfil es obligatorio para usar helper y pagos"
      actions={
        <div className="row">
          <button type="button" onClick={onBack}>
            Volver
          </button>
          <button type="button" onClick={() => void onRefresh()} disabled={loading}>
            Refrescar perfil
          </button>
        </div>
      }
    >
      <section className="section stack">
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={draft.username}
              onChange={(e) => setDraft((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </label>
          <label>
            Nombre visible
            <input
              value={draft.displayName}
              onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              required
            />
          </label>
          <label>
            Telefono E.164
            <input
              value={draft.phoneE164}
              onChange={(e) => setDraft((prev) => ({ ...prev, phoneE164: e.target.value }))}
              required
            />
          </label>
          <label>
            Codigo WhatsApp
            <input
              value={draft.whatsappCountryCode}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, whatsappCountryCode: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Pais de residencia
            <input
              value={draft.countryOfResidence}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, countryOfResidence: e.target.value }))
              }
              required
            />
          </label>
          <label>
            URL imagen de perfil
            <input
              value={draft.profileImageUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, profileImageUrl: e.target.value }))}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>

        <ErrorBanner message={error} />
      </section>
    </Layout>
  )
}
