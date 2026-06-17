'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { changeRole, createStaffUser, toggleActive, updateExtraRoles } from './actions'

type RoleRow = { id: string; name: string; label: string }
type OptionRow = { id: string; name: string }

const ROLES_WITH_SCHOOL = ['lider_eted', 'obreiro_eted']
const ROLES_WITH_MINISTRY = ['lider_ministerio', 'obreiro_ministerio']
const SPECIAL_MINISTRIES: Record<string, { label: string; leaderRole: string }> = {
  dh: { label: 'DH', leaderRole: 'dh' },
  secretaria: { label: 'Secretaria', leaderRole: 'secretaria' },
  hospitalidade: { label: 'Hospitalidade', leaderRole: 'hospitalidade' },
  cozinha: { label: 'Cozinha', leaderRole: 'cozinha' },
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function specialMinistryByName(name: string) {
  return Object.values(SPECIAL_MINISTRIES).find(ministry => normalize(ministry.label) === normalize(name))
}

function roleForScope(scope: string, assignmentRole: string) {
  if (scope.startsWith('school:')) return assignmentRole === 'lider' ? 'lider_eted' : 'obreiro_eted'
  if (scope.startsWith('ministry:')) {
    const ministryName = scope.replace('ministry:', '')
    const special = specialMinistryByName(ministryName)
    if (special && assignmentRole !== 'voluntario') return special.leaderRole
    if (assignmentRole === 'lider') return 'lider_ministerio'
    return 'obreiro_ministerio'
  }
  return ''
}

function areaForScope(scope: string, fallbackArea?: string | null) {
  if (scope.startsWith('school:')) return scope.replace('school:', '')
  if (scope.startsWith('ministry:')) return scope.replace('ministry:', '')
  return fallbackArea ?? ''
}

function assignmentForRole(roleName: string, roleTitle?: string | null) {
  const title = roleTitle?.trim().toLowerCase()
  if (title === 'voluntário' || title === 'voluntario') return 'voluntario'
  if (title === 'obreiro') return 'obreiro'
  if (roleName === 'lider_eted' || roleName === 'lider_ministerio') return 'lider'
  if (Object.values(SPECIAL_MINISTRIES).some(ministry => ministry.leaderRole === roleName)) return 'lider'
  return 'obreiro'
}

function scopeForRole(roleName: string, area?: string | null) {
  if (ROLES_WITH_SCHOOL.includes(roleName)) return area ? `school:${area}` : ''
  if (ROLES_WITH_MINISTRY.includes(roleName)) return area ? `ministry:${area}` : ''
  const specialMinistry = Object.values(SPECIAL_MINISTRIES).find(ministry => ministry.leaderRole === roleName)
  if (specialMinistry) return `ministry:${specialMinistry.label}`
  return ''
}

function roleIdForName(roles: RoleRow[], roleName: string) {
  return roles.find(role => role.name === roleName)?.id ?? (roleName ? `role:${roleName}` : '')
}

function ministryOptions(ministries: OptionRow[]) {
  const special = Object.values(SPECIAL_MINISTRIES).map(ministry => ({ id: `special:${ministry.label}`, name: ministry.label }))
  const seen = new Set(special.map(ministry => normalize(ministry.name)))
  return [
    ...special,
    ...ministries.filter(ministry => {
      const key = normalize(ministry.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ]
}

function AreaSelector({
  schools,
  ministries,
  scope,
  setScope,
  compact,
  formId,
}: {
  schools: OptionRow[]
  ministries: OptionRow[]
  scope: string
  setScope: (value: string) => void
  compact?: boolean
  formId?: string
}) {
  const selectClassName = compact
    ? 'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400'
    : 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <select
      value={scope}
      onChange={event => setScope(event.target.value)}
      className={selectClassName}
      form={formId}
      required
    >
      <option value="">Selecionar área...</option>
        <optgroup label="Escolas">
          {schools.map(school => (
            <option key={school.id} value={`school:${school.name}`}>{school.name}</option>
        ))}
        </optgroup>
        <optgroup label="Ministérios">
          {ministryOptions(ministries).map(ministry => (
            <option key={ministry.id} value={`ministry:${ministry.name}`}>{ministry.name}</option>
          ))}
        </optgroup>
    </select>
  )
}

function FunctionSelector({
  scope,
  assignmentRole,
  setAssignmentRole,
  compact,
  formId,
}: {
  scope: string
  assignmentRole: string
  setAssignmentRole: (value: string) => void
  compact?: boolean
  formId?: string
}) {
  const isScoped = scope.startsWith('school:') || scope.startsWith('ministry:')
  const selectClassName = compact
    ? 'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400'
    : 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400'

  if (!isScoped) {
    return (
      <select className={`${selectClassName} text-gray-400`} disabled>
        <option>Selecione a área primeiro</option>
      </select>
    )
  }

  return (
    <select
      value={assignmentRole}
      onChange={event => setAssignmentRole(event.target.value)}
      className={selectClassName}
      form={formId}
      required
    >
      <option value="obreiro">Obreiro</option>
      <option value="voluntario">Voluntário</option>
      <option value="lider">Líder</option>
    </select>
  )
}

export function ChangeRoleCells({
  orgUserId,
  userId,
  currentRoleId,
  currentRoleName,
  currentArea,
  currentRoleTitle,
  roles,
  schools,
  ministries,
  slug,
  orgId,
}: {
  orgUserId: string
  userId: string
  currentRoleId: string
  currentRoleName: string
  currentArea?: string | null
  currentRoleTitle?: string | null
  roles: RoleRow[]
  schools: OptionRow[]
  ministries: OptionRow[]
  slug: string
  orgId: string
}) {
  const [scope, setScope] = useState(scopeForRole(currentRoleName, currentArea))
  const [assignmentRole, setAssignmentRole] = useState(assignmentForRole(currentRoleName, currentRoleTitle))
  const roleName = roleForScope(scope, assignmentRole)
  const roleId = useMemo(() => roleIdForName(roles, roleName), [roleName, roles])
  const area = areaForScope(scope, currentArea)
  const isSpecialMinistry = scope.startsWith('ministry:') && Boolean(specialMinistryByName(area))
  const roleTitle = assignmentRole === 'voluntario'
    ? 'Voluntário'
    : isSpecialMinistry && assignmentRole === 'obreiro'
      ? 'Obreiro'
      : currentRoleTitle?.trim().toLowerCase() === 'voluntário' || currentRoleTitle?.trim().toLowerCase() === 'voluntario' || currentRoleTitle?.trim().toLowerCase() === 'obreiro'
      ? ''
      : currentRoleTitle ?? ''
  const formId = `change-role-${orgUserId}`

  return (
    <>
      <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
        <AreaSelector
          schools={schools}
          ministries={ministries}
          scope={scope}
          setScope={setScope}
          compact
          formId={formId}
        />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <form id={formId} action={changeRole} className="hidden">
          <input type="hidden" name="org_user_id" value={orgUserId} />
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="current_role_id" value={currentRoleId} />
          <input type="hidden" name="role_id" value={roleId} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="role_title" value={roleTitle} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="org_id" value={orgId} />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <FunctionSelector
            scope={scope}
            assignmentRole={assignmentRole}
            setAssignmentRole={setAssignmentRole}
            compact
            formId={formId}
          />
          <button
            type="submit"
            form={formId}
            className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
          >
            Salvar
          </button>
        </div>
      </td>
    </>
  )
}

export function ToggleActiveForm({
  orgUserId,
  active,
  slug,
  disabled,
}: {
  orgUserId: string
  active: boolean
  slug: string
  disabled: boolean
}) {
  return (
    <form action={toggleActive}>
      <input type="hidden" name="org_user_id" value={orgUserId} />
      <input type="hidden" name="active" value={String(active)} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={disabled}
        className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          active
            ? 'bg-red-50 text-red-600 hover:bg-red-100'
            : 'bg-green-50 text-green-700 hover:bg-green-100'
        }`}
      >
        {active ? 'Desativar' : 'Reativar'}
      </button>
    </form>
  )
}

export function ObreiroCard({
  orgUserId, userId, currentRoleId, currentRoleName, currentArea, currentRoleTitle,
  roles, schools, ministries, slug, orgId, fullName, email, active, isCurrentUser,
  accumulatedRoleLabels = [], currentExtraRoles = [], viewerIsDH = false,
}: {
  orgUserId: string; userId: string; currentRoleId: string; currentRoleName: string
  currentArea?: string | null; currentRoleTitle?: string | null
  roles: RoleRow[]; schools: OptionRow[]; ministries: OptionRow[]
  slug: string; orgId: string; fullName: string; email: string; active: boolean; isCurrentUser: boolean
  accumulatedRoleLabels?: string[]
  currentExtraRoles?: string[]
  viewerIsDH?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState(scopeForRole(currentRoleName, currentArea))
  const [assignmentRole, setAssignmentRole] = useState(assignmentForRole(currentRoleName, currentRoleTitle))
  const roleName = roleForScope(scope, assignmentRole)
  const roleId = useMemo(() => roleIdForName(roles, roleName), [roleName, roles])
  const area = areaForScope(scope, currentArea)
  const isSpecialMinistry = scope.startsWith('ministry:') && Boolean(specialMinistryByName(area))
  const roleTitle = assignmentRole === 'voluntario'
    ? 'Voluntário'
    : isSpecialMinistry && assignmentRole === 'obreiro'
      ? 'Obreiro'
      : ['voluntário', 'voluntario', 'obreiro'].includes(currentRoleTitle?.trim().toLowerCase() ?? '')
        ? ''
        : currentRoleTitle ?? ''
  const roleLabel = roles.find(r => r.name === currentRoleName)?.label ?? currentRoleName

  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${!active ? 'opacity-60' : ''}`}>
      {/* Cabeçalho clicável */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`font-semibold leading-snug transition-colors ${open ? 'text-brand-600' : 'text-gray-900'}`}>{fullName}</p>
              <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-400' : ''}`} />
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">{email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {currentArea && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{currentArea}</span>
              )}
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{roleLabel}</span>
              {currentRoleTitle && !['voluntário', 'voluntario', 'obreiro'].includes(currentRoleTitle.toLowerCase()) && (
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">{currentRoleTitle}</span>
              )}
              {(accumulatedRoleLabels.length > 0 || currentExtraRoles.length > 0) && (
                <span className="rounded-md bg-amber-50 border border-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  +{[
                    ...accumulatedRoleLabels,
                    ...currentExtraRoles.map(r => roles.find(role => role.name === r)?.label ?? r),
                  ].join(', ')}
                </span>
              )}
            </div>
          </div>
          <span className={`shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </button>

      {/* Rodapé */}
      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex flex-1 items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          <span>{open ? 'Fechar edição' : 'Editar função'}</span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <ToggleActiveForm orgUserId={orgUserId} active={active} slug={slug} disabled={isCurrentUser} />
      </div>

      {/* Formulário expandível */}
      {open && (
        <>
          <form action={changeRole} className="border-t border-gray-100 p-4 space-y-3 bg-white">
            <input type="hidden" name="org_user_id" value={orgUserId} />
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="current_role_id" value={currentRoleId} />
            <input type="hidden" name="role_id" value={roleId} />
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="role_title" value={roleTitle} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="org_id" value={orgId} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Área</label>
                <AreaSelector schools={schools} ministries={ministries} scope={scope} setScope={setScope} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Função</label>
                <FunctionSelector scope={scope} assignmentRole={assignmentRole} setAssignmentRole={setAssignmentRole} />
              </div>
            </div>
            <button type="submit" className="w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600">
              Salvar alterações
            </button>
          </form>

          {viewerIsDH && (
            <form action={updateExtraRoles} className="border-t border-dashed border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <input type="hidden" name="org_user_id" value={orgUserId} />
              <input type="hidden" name="org_id" value={orgId} />
              <input type="hidden" name="slug" value={slug} />
              <p className="text-xs font-semibold text-gray-700">Funções adicionais</p>
              <p className="text-xs text-gray-400 -mt-2">Áreas extras que esta pessoa também cobre individualmente.</p>
              <div className="flex flex-wrap gap-2">
                {roles
                  .filter(r => r.name !== currentRoleName && !['superadmin', 'admin_base', 'lider_base'].includes(r.name))
                  .map(r => (
                    <label key={r.name} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs hover:border-amber-300 hover:bg-amber-50">
                      <input
                        type="checkbox"
                        name="extra_roles"
                        value={r.name}
                        defaultChecked={currentExtraRoles.includes(r.name)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-gray-700">{r.label}</span>
                    </label>
                  ))}
              </div>
              <button type="submit" className="rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors">
                Salvar funções adicionais
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

export function CreateStaffUserForm({
  roles,
  schools,
  ministries,
  orgId,
  slug,
}: {
  roles: RoleRow[]
  schools: OptionRow[]
  ministries: OptionRow[]
  orgId: string
  slug: string
}) {
  const [scope, setScope] = useState('')
  const [assignmentRole, setAssignmentRole] = useState('obreiro')
  const roleName = roleForScope(scope, assignmentRole)
  const roleId = useMemo(() => roleIdForName(roles, roleName), [roleName, roles])
  const area = areaForScope(scope)
  const isSpecialMinistry = scope.startsWith('ministry:') && Boolean(specialMinistryByName(area))
  const defaultRoleTitle = assignmentRole === 'voluntario' ? 'Voluntário' : isSpecialMinistry && assignmentRole === 'obreiro' ? 'Obreiro' : ''

  return (
    <form action={createStaffUser} className="space-y-4">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="role_id" value={roleId} />
      <input type="hidden" name="role_title_fallback" value={defaultRoleTitle} />
      <input type="hidden" name="area" value={area} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="full_name" type="text" placeholder="João da Silva" required />
        <Field label="E-mail" name="email" type="email" placeholder="joao@exemplo.com" required />
        <Field label="Senha temporária" name="password" type="password" placeholder="Mínimo 6 caracteres" required />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Área</label>
          <AreaSelector
            schools={schools}
            ministries={ministries}
            scope={scope}
            setScope={setScope}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Função</label>
          <FunctionSelector
            scope={scope}
            assignmentRole={assignmentRole}
            setAssignmentRole={setAssignmentRole}
          />
        </div>

        <Field label="Função descritiva" name="role_title" type="text" placeholder="Instrutor, monitor, administrativo..." defaultValue={defaultRoleTitle} />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Criar obreiro
        </button>
        <p className="mt-2 text-xs text-gray-400">
          Se o e-mail já existir, o usuário será vinculado a esta base e reativado com a função selecionada.
        </p>
      </div>
    </form>
  )
}

export function CreateObreiroModal({
  roles, schools, ministries, orgId, slug,
}: {
  roles: RoleRow[]; schools: OptionRow[]; ministries: OptionRow[]; orgId: string; slug: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
      >
        + Novo obreiro
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Novo obreiro</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <CreateStaffUserForm roles={roles} schools={schools} ministries={ministries} orgId={orgId} slug={slug} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, name, type, placeholder, required, defaultValue }: {
  label: string
  name: string
  type: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
