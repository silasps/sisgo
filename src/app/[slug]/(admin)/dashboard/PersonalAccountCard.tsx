import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { UtensilsCrossed, Wallet, Shirt, IdCard, type LucideIcon } from 'lucide-react'
import { SectionCard } from './ui'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Resumo de acesso pessoal (refeições, contas, lavanderia, carteirinha) — todo
// usuário com login tem essas 4 páginas, então esse card aparece em todos os
// papéis, sem gate de permissão. Cada mini-item leva direto pra sua própria
// página; não existe "ver tudo" porque não há uma página que agregue as 4.
export async function PersonalAccountCard({ slug, orgId, userId, laundryEnabled }: {
  slug: string; orgId: string; userId: string; laundryEnabled: boolean
}) {
  const sbAdmin = createAdminClient()

  const [{ data: staffProfile }, { data: studentProfile }, { data: associadoProfile }] = await Promise.all([
    sbAdmin.from('staff_profiles').select('person_id').eq('user_id', userId).eq('organization_id', orgId).maybeSingle(),
    sbAdmin.from('student_profiles').select('person_id').eq('user_id', userId).eq('organization_id', orgId).maybeSingle(),
    sbAdmin.from('associado_profiles').select('person_id').eq('user_id', userId).eq('organization_id', orgId).maybeSingle(),
  ])
  const personId = staffProfile?.person_id ?? studentProfile?.person_id ?? associadoProfile?.person_id ?? null

  const [{ count: pendingMeals }, chargesResult, tokenResult] = await Promise.all([
    sbAdmin.from('kitchen_meal_consumers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('requested_by', userId)
      .eq('payment_status', 'pending'),
    personId
      ? sbAdmin.from('finance_charges').select('amount').eq('organization_id', orgId).eq('person_id', personId).in('status', ['pending', 'overdue'])
      : Promise.resolve({ data: [] as Array<{ amount: number }> }),
    personId
      ? sbAdmin.from('person_public_tokens').select('token').eq('person_id', personId).is('revoked_at', null).maybeSingle()
      : Promise.resolve({ data: null as { token: string } | null }),
  ])

  const pendingBalance = (chargesResult.data ?? []).reduce((s, c) => s + Number(c.amount), 0)

  return (
    <SectionCard title="Minha conta">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <PersonalTile
          icon={UtensilsCrossed}
          label="Refeições"
          href={`/${slug}/refeicoes`}
          status={(pendingMeals ?? 0) > 0 ? `${pendingMeals} pendente${(pendingMeals ?? 0) > 1 ? 's' : ''}` : 'Em dia'}
          alert={(pendingMeals ?? 0) > 0}
        />
        <PersonalTile
          icon={Wallet}
          label="Minhas Contas"
          href={`/${slug}/minhas-contas`}
          status={pendingBalance > 0 ? `${fmt(pendingBalance)} pendente` : 'Sem pendências'}
          alert={pendingBalance > 0}
        />
        {laundryEnabled && (
          <PersonalTile icon={Shirt} label="Lavanderia" href={`/${slug}/minha-lavanderia`} status="Reservar máquina" />
        )}
        <PersonalTile
          icon={IdCard}
          label="Carteirinha"
          href={`/${slug}/minha-carteirinha`}
          status={tokenResult.data ? 'Ativa' : 'Gerar'}
        />
      </div>
    </SectionCard>
  )
}

function PersonalTile({ icon: Icon, label, status, href, alert }: {
  icon: LucideIcon; label: string; status: string; href: string; alert?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-brand-50 hover:border-brand-100"
    >
      <Icon size={18} className="text-brand-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-700 truncate">{label}</p>
        <p className={`text-[11px] mt-0.5 truncate ${alert ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{status}</p>
      </div>
    </Link>
  )
}
