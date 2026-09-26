import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { MuralClient } from '../../../ministerios/[id]/mural/MuralClient'
import { GroupChatHeader } from '../../GroupChatHeader'

type Props = { params: Promise<{ slug: string; id: string }> }

// Grupo da escola dentro do Chat unificado — mesmo MuralClient reaproveitado
// pro ministério, só trocando school_id no lugar de ministry_id (mesma
// tabela school_messages de sempre, sem migrar dado).
export default async function SchoolGroupChatPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  // Mesmo gate de acesso que escolas/[id]/layout.tsx usa — sem isso, gestão
  // sem vínculo pessoal com ESTA escola (comum: lider_base não é
  // necessariamente school_leader/school_staff de toda escola) caía num
  // notFound() indevido.
  const link = isManagement ? null : await getSchoolLink({ userId: user.id, orgId, role, preview }, id)
  if (!isManagement && !link) notFound()
  const canWrite = isOperationalManager(role) || link === 'lider'

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!escola) notFound()

  const { data: profile } = await sbAdmin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const [{ data: messagesRaw }, { data: staffRaw }] = await Promise.all([
    sbAdmin.from('school_messages')
      .select('id, author_name, author_id, content, mentions, color, font, text_color, font_size, created_at')
      .eq('school_id', id)
      .order('created_at', { ascending: true })
      .limit(30),
    sbAdmin.from('school_staff')
      .select('person_id, people(full_name)')
      .eq('school_id', id)
      .eq('active', true),
  ])

  const messages = (messagesRaw ?? []).map(m => ({
    ...m,
    mentions: (m.mentions as string[] | null) ?? [],
    font: (m as unknown as { font: number }).font ?? 0,
    text_color: (m as unknown as { text_color: number }).text_color ?? 0,
    font_size: (m as unknown as { font_size: number }).font_size ?? 1,
  }))

  const members = (staffRaw ?? []).map(s => ({
    person_id: s.person_id,
    name: (s.people as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))

  let nextColor = 0
  if (messages.length > 0) nextColor = (messages[messages.length - 1].color + 1) % 6

  await sbAdmin.from('school_message_reads').upsert(
    { user_id: user.id, school_id: id, last_read_at: new Date().toISOString() },
    { onConflict: 'user_id,school_id' },
  )

  async function postMessage(formData: FormData) {
    'use server'
    if (!user) return
    const content = (formData.get('content') as string).trim()
    if (!content) return
    const mentionMatches = content.match(/@[\w\s]+/g) ?? []
    const mentionedIds: string[] = []
    for (const match of mentionMatches) {
      const name = match.slice(1).trim().toLowerCase()
      const member = members.find(m => m.name.toLowerCase().startsWith(name))
      if (member) mentionedIds.push(member.person_id)
    }
    const db = createAdminClient()
    await db.from('school_messages').insert({
      organization_id: orgId, school_id: id, author_id: user.id,
      author_name: authorName, content, mentions: mentionedIds,
      color: Number(formData.get('color') ?? nextColor),
      font: Number(formData.get('font') ?? 0),
      text_color: Number(formData.get('text_color') ?? 0),
      font_size: Number(formData.get('font_size') ?? 1),
    })
    const { data: excess } = await db.from('school_messages')
      .select('id').eq('school_id', id)
      .order('created_at', { ascending: false })
      .range(30, 999)
    if (excess?.length) await db.from('school_messages').delete().in('id', excess.map(e => e.id))
  }

  async function deleteMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    if (!messageId) return
    const db = createAdminClient()
    await db.from('school_messages').delete().eq('id', messageId).eq('school_id', id)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <GroupChatHeader slug={slug} name={escola.name} />
      <MuralClient
        messages={messages}
        members={members}
        currentUserId={user.id}
        currentUserName={authorName}
        canDelete={canWrite}
        nextColor={nextColor}
        postAction={postMessage}
        deleteAction={deleteMessage}
      />
    </div>
  )
}
