'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AccountCredentialsCard } from '@/components/staff/AccountCredentialsCard'
import type { AccountCredentials } from '@/lib/staff/accountCredentials'

type Props = {
  fullName: string
  action: () => Promise<{ error: string } | AccountCredentials>
  addPhoneAction: (formData: FormData) => Promise<{ error: string } | { ok: true; phone: string }>
}

// Pra quando a pessoa não consegue entrar (esqueceu a senha, nunca recebeu
// as credenciais) e não é o caso de "Remover acesso" (isso perde o e-mail
// cadastrado e qualquer liderança/vínculo some junto) — só troca a senha e
// devolve pronta pra entregar de novo, no mesmo card de sempre.
export function ResetPasswordCard({ fullName, action, addPhoneAction }: Props) {
  const router = useRouter()
  const [created, setCreated] = useState<AccountCredentials | null>(null)

  function handleAddPhone(phone: string) {
    const fd = new FormData()
    fd.append('phone', phone)
    return addPhoneAction(fd)
  }

  if (created) {
    return (
      <AccountCredentialsCard
        title="Senha redefinida com sucesso."
        passwordLabel="Nova senha provisória"
        credentials={created}
        onAddPhone={handleAddPhone}
        onDone={() => router.refresh()}
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Redefinir senha</h2>
      <p className="text-xs text-gray-400 mb-3">
        Gera uma senha provisória nova pra essa pessoa — útil se ela esqueceu a senha ou nunca
        recebeu as credenciais. Não mexe no e-mail nem em nenhuma liderança/vínculo que ela já tenha.
      </p>
      <ConfirmDialog
        variant="warning"
        message={`Gerar uma nova senha provisória pra ${fullName}? A senha atual dela deixa de funcionar.`}
        confirmLabel="Gerar nova senha"
        onConfirm={async () => {
          const res = await action()
          if ('error' in res) { toast.error(res.error); return }
          setCreated(res)
        }}
      >
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <KeyRound size={15} /> Gerar nova senha
        </button>
      </ConfirmDialog>
    </div>
  )
}
