import { headers } from 'next/headers'

export type PersonCardPublic = {
  person_id: string
  full_name: string
  photo_url: string | null
  organization: { name: string; logo_url: string | null; accent_color: string | null; slug: string }
  is_student: boolean
  is_staff: boolean
  staff_role_title: string | null
  active: boolean
}

export type PersonTimelineEntry = {
  kind: 'status' | 'staff' | 'student'
  label: string
  started_at: string | null
  ended_at: string | null
  detail: string | null
}

/** Papel exibido no cartão — nunca um rótulo fixo, sempre derivado do estado atual dos perfis. */
export function formatCardRole(isStudent: boolean, isStaff: boolean, staffRoleTitle: string | null): string {
  if (isStudent && isStaff) return staffRoleTitle ? `Obreiro (${staffRoleTitle}) e Aluno` : 'Obreiro e Aluno'
  if (isStaff) return staffRoleTitle || 'Obreiro'
  if (isStudent) return 'Aluno'
  return 'Membro'
}

/** Origem absoluta da requisição atual — usada só para montar a URL codificada no QR. */
export async function getRequestOrigin(): Promise<string> {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'sisgomission.com'
  const proto = hdrs.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  return `${proto}://${host.split(',')[0].trim()}`
}

export function buildCardVerifyPath(slug: string, token: string): string {
  return `/${slug}/carteirinha/${token}`
}
