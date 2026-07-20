import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

type OrgUserRow = {
  id: string
  user_id: string
  active: boolean
  created_at: string
  roles: { id: string; name: string; label: string } | null
}

// Roles disponíveis para bases (excluindo superadmin)
const BASE_ROLE_ORDER = ['lider_base', 'admin_base', 'dh', 'secretaria', 'hospitalidade', 'cozinha', 'lider_eted']

export default async function UsuariosPage({ params }: Props) {
  const { id: orgId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: base } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .single()

  if (!base) notFound()

  // Usuários da org com seus roles
  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('id, user_id, active, created_at, roles(id, name, label)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  // Todos os roles disponíveis para bases
  const { data: allRoles } = await supabase
    .from('roles')
    .select('id, name, label')
    .neq('name', 'superadmin')
    .order('name')

  const sortedRoles = (allRoles ?? []).sort(
    (a, b) => BASE_ROLE_ORDER.indexOf(a.name) - BASE_ROLE_ORDER.indexOf(b.name)
  )

  // Dados de autenticação dos usuários via admin API
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = Object.fromEntries(authUsers.map(u => [u.id, u]))

  const rows = ((orgUsers ?? []) as unknown as OrgUserRow[]).map(ou => ({
    ...ou,
    email: authMap[ou.user_id]?.email ?? '—',
    full_name: (authMap[ou.user_id]?.user_metadata?.full_name as string | undefined) ?? '',
  }))

  return (
    <>
      <Header
        title={`Usuários — ${base.name}`}
        actions={
          <Link href={`/superadmin/bases/${orgId}`} className="text-sm text-gray-300 hover:text-white">
            ← Voltar
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-8 max-w-4xl">

        {/* Lista de usuários */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">
            Usuários cadastrados <span className="text-gray-400 font-normal">({rows.length})</span>
          </h2>

          {!rows.length ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-400 text-sm">Nenhum usuário nesta base ainda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Usuário</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Função</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(u => (
                    <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{u.full_name || u.email}</p>
                        {u.full_name && <p className="text-xs text-gray-400">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <ChangeRoleForm
                          orgUserId={u.id}
                          currentRoleId={(u.roles as OrgUserRow['roles'])?.id ?? ''}
                          roles={sortedRoles}
                          orgId={orgId}
                        />
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ToggleActiveForm orgUserId={u.id} active={u.active} orgId={orgId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Formulário: novo usuário */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Adicionar usuário</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <CreateUserForm roles={sortedRoles} orgId={orgId} />
          </div>
        </section>

      </main>
    </>
  )
}

// ----------------------------------------------------------------
// Componente: troca de role inline
// ----------------------------------------------------------------
function ChangeRoleForm({ orgUserId, currentRoleId, roles, orgId }: {
  orgUserId: string
  currentRoleId: string
  roles: { id: string; name: string; label: string }[]
  orgId: string
}) {
  async function changeRole(formData: FormData) {
    'use server'
    const roleId = formData.get('role_id') as string
    if (!roleId || roleId === currentRoleId) return
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('organization_users').update({ role_id: roleId, updated_at: new Date().toISOString() }).eq('id', orgUserId)
    redirect(`/superadmin/bases/${orgId}/usuarios`)
  }

  return (
    <form action={changeRole} className="flex items-center gap-2">
      <select
        name="role_id"
        defaultValue={currentRoleId}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        {roles.map(r => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
      <button type="submit" className="text-xs px-2 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors font-medium">
        Salvar
      </button>
    </form>
  )
}

// ----------------------------------------------------------------
// Componente: ativar / desativar usuário
// ----------------------------------------------------------------
function ToggleActiveForm({ orgUserId, active, orgId }: {
  orgUserId: string
  active: boolean
  orgId: string
}) {
  async function toggle() {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('organization_users').update({ active: !active, updated_at: new Date().toISOString() }).eq('id', orgUserId)
    redirect(`/superadmin/bases/${orgId}/usuarios`)
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
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

// ----------------------------------------------------------------
// Componente: criar novo usuário
// ----------------------------------------------------------------
function CreateUserForm({ roles, orgId }: {
  roles: { id: string; name: string; label: string }[]
  orgId: string
}) {
  async function createUser(formData: FormData) {
    'use server'
    const email     = (formData.get('email') as string).trim().toLowerCase()
    const full_name = (formData.get('full_name') as string).trim()
    const password  = formData.get('password') as string
    const role_id   = formData.get('role_id') as string

    if (!email || !full_name || !password || !role_id) return

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    // Verifica se usuário já existe no auth
    const { data: { users: existing } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    let userId: string

    const found = existing.find(u => u.email?.toLowerCase() === email)
    if (found) {
      userId = found.id
    } else {
      // Cria o usuário no Supabase Auth
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name },
        email_confirm: true,
      })
      if (error || !created.user) return
      userId = created.user.id
    }

    // Verifica se já está na org
    const { data: existing_ou } = await admin
      .from('organization_users')
      .select('id, active')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .single()

    if (existing_ou) {
      // Só atualiza role e reativa se estava inativo
      await admin.from('organization_users')
        .update({ role_id, active: true, updated_at: new Date().toISOString() })
        .eq('id', existing_ou.id)
    } else {
      await admin.from('organization_users').insert({
        user_id: userId,
        organization_id: orgId,
        role_id,
        active: true,
      })
    }

    redirect(`/superadmin/bases/${orgId}/usuarios`)
  }

  return (
    <form action={createUser} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo" name="full_name" type="text" placeholder="João da Silva" required />
        <Field label="E-mail" name="email" type="email" placeholder="joao@exemplo.com" required />
        <Field label="Senha temporária" name="password" type="password" placeholder="Mínimo 6 caracteres" required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
          <select
            name="role_id"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Selecionar função...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="pt-2">
        <button
          type="submit"
          className="px-5 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
        >
          Criar usuário
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Se o e-mail já tiver conta no sistema, ele será adicionado a esta base com a função selecionada.
        </p>
      </div>
    </form>
  )
}

function Field({ label, name, type, placeholder, required }: {
  label: string; name: string; type: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
