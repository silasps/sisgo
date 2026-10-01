import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

// Forma mínima que o AccountCredentialsCard precisa pra mostrar e-mail/senha
// e montar o botão de WhatsApp — cada action que cria/redefine acesso
// devolve isso (mais o que mais precisar, tipo orgUserId, à parte).
export type AccountCredentials = {
  email: string
  password: string
  phone: string | null
  whatsappMessage: string
}

// Mesma ordem de preferência usada em escolas/[id]/configuracoes/page.tsx
// pro botão de WhatsApp: whatsapp primário > whatsapp > phone primário > phone.
export async function lookupPersonPhone(db: AdminClient, personId: string): Promise<string | null> {
  const { data: contacts } = await db.from('person_contacts')
    .select('type, value, is_primary').eq('person_id', personId).in('type', ['whatsapp', 'phone'])
  const rows = contacts ?? []
  return rows.find(c => c.type === 'whatsapp' && c.is_primary)?.value
    ?? rows.find(c => c.type === 'whatsapp')?.value
    ?? rows.find(c => c.type === 'phone' && c.is_primary)?.value
    ?? rows.find(c => c.type === 'phone')?.value
    ?? null
}

// *asterisco* vira negrito no WhatsApp — \n\n separa em parágrafos de
// verdade (sem isso o texto chega tudo grudado numa linha só).
export function buildWelcomeWhatsappMessage(p: { fullName: string; orgName: string; loginUrl: string; email: string; password: string }): string {
  return [
    `Olá, ${p.fullName}!\n\nSeu acesso ao SISGO em *${p.orgName}* foi criado. 👏`,
    `🔐 *Dados de acesso*\nLink: ${p.loginUrl}\nE-mail: ${p.email}\nSenha provisória: *${p.password}*`,
    `⚠️ No primeiro acesso você vai precisar trocar essa senha.`,
  ].join('\n\n')
}

export function buildResetWhatsappMessage(p: { fullName: string; orgName: string; loginUrl: string; email: string; password: string }): string {
  return [
    `Olá, ${p.fullName}!\n\nSua senha de acesso ao SISGO em *${p.orgName}* foi redefinida.`,
    `🔐 *Dados de acesso*\nLink: ${p.loginUrl}\nE-mail: ${p.email}\nNova senha provisória: *${p.password}*`,
    `⚠️ No próximo acesso você vai precisar trocar essa senha.`,
  ].join('\n\n')
}
