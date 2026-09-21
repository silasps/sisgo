'use client'

const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-gray-50'

export function ResponsavelSection({ data }: { data?: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">Responsável pela conta</h2>
      <p className="text-xs text-gray-500 -mt-3">
        Esta pessoa será a administradora da organização no sistema.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo *</label>
          <input name="responsavel_nome" required defaultValue={data?.responsavel_nome} placeholder="João da Silva" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo</label>
          <input name="responsavel_cargo" defaultValue={data?.responsavel_cargo} placeholder="Diretor, coordenador..." className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail *</label>
        <input type="email" name="responsavel_email" required defaultValue={data?.responsavel_email} placeholder="voce@exemplo.com" className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha *</label>
          <input type="password" name="responsavel_senha" required minLength={6} defaultValue={data?.responsavel_senha} placeholder="Mínimo 6 caracteres" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha *</label>
          <input type="password" name="responsavel_senha_confirma" required minLength={6} defaultValue={data?.responsavel_senha_confirma} placeholder="Repita a senha" className={inputClass} />
        </div>
      </div>
    </div>
  )
}
