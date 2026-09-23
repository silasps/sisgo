import { createAdminClient } from '@/lib/supabase/admin'
import { SCHOOL_APPLICATION_TYPES } from '@/lib/schools'
import type { ImportContext, ImportDestinoOption } from './types'

export async function buildImportContext(organizationId: string, slug: string): Promise<ImportContext> {
  const db = createAdminClient()

  const [{ data: classesRaw }, { data: ministriesRaw }, { data: schoolsRaw }] = await Promise.all([
    db.from('school_classes')
      .select('id, school_id, name, schools!inner(name, organization_id, school_type)')
      .eq('active', true)
      .eq('schools.organization_id', organizationId)
      .in('schools.school_type', [...SCHOOL_APPLICATION_TYPES])
      .order('name'),
    db.from('ministries').select('id, name').eq('organization_id', organizationId).eq('active', true).order('name'),
    db.from('schools').select('id, name').eq('organization_id', organizationId).eq('active', true).order('name'),
  ])

  type ClassRow = { id: string; school_id: string; name: string; schools: { name: string } | null }
  const turmas: ImportDestinoOption[] = ((classesRaw ?? []) as unknown as ClassRow[]).map(c => ({
    tipo: 'turma',
    id: c.id,
    schoolId: c.school_id,
    label: c.schools?.name ? `${c.name} — ${c.schools.name}` : c.name,
  }))

  const destinosObreiro: ImportDestinoOption[] = [
    ...((ministriesRaw ?? []) as Array<{ id: string; name: string }>).map(m => ({
      tipo: 'ministerio' as const,
      id: m.id,
      label: `Ministério: ${m.name}`,
    })),
    ...((schoolsRaw ?? []) as Array<{ id: string; name: string }>).map(s => ({
      tipo: 'escola' as const,
      id: s.id,
      label: `Escola: ${s.name}`,
    })),
  ]

  return { organizationId, slug, turmas, destinosObreiro }
}
