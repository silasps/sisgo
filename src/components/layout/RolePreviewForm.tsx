'use client'

import { useMemo, useState } from 'react'
import type { RolePreview, RolePreviewValue } from '@/lib/role-preview'

const ROLE_OPTIONS: Array<{ value: RolePreviewValue; label: string }> = [
  { value: 'superadmin', label: 'Super admin' },
  { value: 'lider_base', label: 'Líder da Base' },
  { value: 'dh', label: 'DH' },
  { value: 'secretaria', label: 'Secretaria / Administrativo' },
  { value: 'hospitalidade', label: 'Hospitalidade' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'lider_eted', label: 'Líder de Escola' },
  { value: 'obreiro_eted', label: 'Obreiro de Escola' },
  { value: 'aluno', label: 'Aluno' },
  { value: 'associado', label: 'Associado' },
  { value: 'lider_ministerio', label: 'Líder de Ministério' },
  { value: 'obreiro_ministerio', label: 'Obreiro de Ministério' },
]

type Props = {
  action: (formData: FormData) => void | Promise<void>
  preview?: RolePreview | null
  schools: Array<{ id: string; name: string }>
  ministries: Array<{ id: string; name: string }>
  redirectTo?: string
}

export function RolePreviewForm({ action, preview, schools, ministries, redirectTo }: Props) {
  const [role, setRole] = useState<RolePreviewValue>(preview?.role ?? 'superadmin')

  const scope = useMemo(() => {
    if (role === 'lider_eted' || role === 'obreiro_eted' || role === 'aluno') {
      return {
        label: 'Escola',
        placeholder: 'Escolha a escola',
        options: schools,
        defaultValue: preview?.schoolId ?? '',
      }
    }

    if (role === 'lider_ministerio' || role === 'obreiro_ministerio') {
      return {
        label: 'Ministério',
        placeholder: 'Escolha o ministério',
        options: ministries,
        defaultValue: preview?.ministryId ?? '',
      }
    }

    return null
  }, [ministries, preview?.ministryId, preview?.schoolId, role, schools])

  return (
    <form action={action} className="ml-auto flex items-center gap-1.5">
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <span className="hidden sm:inline text-gray-500">Visualizar como</span>
      <select
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value as RolePreviewValue)}
        className="h-7 rounded-md border border-white/10 bg-gray-800 px-2 text-xs text-white outline-none"
      >
        {ROLE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {scope && (
        <select
          key={role}
          name="scope_id"
          defaultValue={scope.defaultValue}
          aria-label={scope.label}
          required
          className="h-7 max-w-44 rounded-md border border-white/10 bg-gray-800 px-2 text-xs text-white outline-none"
        >
          <option value="">{scope.placeholder}</option>
          {scope.options.map(option => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
      )}

      <button type="submit" className="h-7 rounded-md bg-white px-2 text-xs font-semibold text-gray-900 hover:bg-gray-200">
        Aplicar
      </button>
    </form>
  )
}
