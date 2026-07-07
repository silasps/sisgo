import { createClient } from '@/lib/supabase/server'
import type { PersonCardPublic, PersonTimelineEntry } from '@/lib/carteirinha'

type Props = { params: Promise<{ slug: string; token: string }> }

function formatMonthYear(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const KIND_LABEL: Record<PersonTimelineEntry['kind'], string> = {
  status: 'Status',
  staff: 'Obreiro',
  student: 'Aluno',
}

export default async function CarteirinhaPublicaPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: cardData } = await supabase.rpc('get_person_card_public', { p_token: token })
  const card = cardData as PersonCardPublic | null

  if (!card) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-gray-700 font-semibold">Carteirinha não encontrada</p>
          <p className="text-sm text-gray-400 mt-1">O link pode ter expirado ou sido revogado.</p>
        </div>
      </main>
    )
  }

  const { data: timelineData } = await supabase.rpc('get_person_timeline', { p_person_id: card.person_id })
  const timeline = (timelineData ?? []) as PersonTimelineEntry[]

  const role = card.is_student && card.is_staff
    ? (card.staff_role_title ? `Obreiro (${card.staff_role_title}) e Aluno` : 'Obreiro e Aluno')
    : card.is_staff ? (card.staff_role_title || 'Obreiro')
    : card.is_student ? 'Aluno'
    : 'Membro'

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div
        className="px-6 pt-10 pb-8 text-white"
        style={{ backgroundColor: '#111827' }}
      >
        <div className="max-w-md mx-auto flex flex-col items-center text-center gap-3">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
            {card.photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={card.photo_url} alt={card.full_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white/60">
                {card.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{card.full_name}</h1>
            <p className="text-sm text-white/70">{role}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${card.active ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'}`}>
            {card.active ? 'Vínculo ativo' : 'Vínculo encerrado'}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-4 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          {card.organization.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={card.organization.logo_url} alt={card.organization.name} className="h-8 max-w-[100px] object-contain" />
          ) : null}
          <p className="text-sm font-medium text-gray-700">{card.organization.name}</p>
        </div>

        {timeline.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">História</h2>
            <ol className="space-y-4">
              {timeline.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{entry.label}</p>
                    <p className="text-xs text-gray-400">
                      {KIND_LABEL[entry.kind]}
                      {entry.detail ? ` · ${entry.detail}` : ''}
                      {entry.started_at ? ` · desde ${formatMonthYear(entry.started_at)}` : ''}
                      {entry.ended_at ? ` até ${formatMonthYear(entry.ended_at)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Documento de identificação institucional. Não é válido como carteira de meia-entrada.
        </p>
      </div>
    </main>
  )
}
