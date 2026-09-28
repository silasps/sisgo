'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { PROFILE_COMPLETION_BLOCK_AFTER } from '@/lib/profile-completion'

const DISMISS_KEY = 'sisgo:cadastro-incompleto-dismissed'

// Fechável até estourar PROFILE_COMPLETION_BLOCK_AFTER (a pessoa pode adiar e seguir usando o
// sistema), mas volta a aparecer a cada novo login/sessão — por isso
// sessionStorage só controla "já vi nesta sessão"; a contagem de quantas
// vezes já adiou (`skipsUsed`) vem do banco, vinculada à candidatura da
// pessoa (não ao navegador), pra não se perder ao trocar de dispositivo.
export function CadastroIncompletoAlert({ href, skipsUsed, onSkip }: {
  href: string
  skipsUsed: number
  onSkip: () => Promise<void>
}) {
  const [visible, setVisible] = useState(false)
  const [navigating, setNavigating] = useState(false)

  const blocking = skipsUsed >= PROFILE_COMPLETION_BLOCK_AFTER

  useEffect(() => {
    if (!blocking) {
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === '1') return
      } catch { /* sessionStorage indisponível — mostra normalmente */ }
    }
    setVisible(true)
  }, [blocking])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ok ignorar */ }
    setVisible(false)
    void onSkip()
  }

  if (!visible) return null

  const lastChance = !blocking && skipsUsed === PROFILE_COMPLETION_BLOCK_AFTER - 1

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 relative">
        {!blocking && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <AlertTriangle className="size-5" />
          <h2 className="font-semibold text-gray-900">Cadastro incompleto</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {blocking
            ? 'Pra continuar usando o sistema, complete seu cadastro agora — é rápido.'
            : 'Seu cadastro ainda não foi concluído. Você pode continuar usando o sistema por enquanto, mas complete assim que puder — dá pra fazer aos poucos, em várias visitas.'}
        </p>
        {lastChance && (
          <p className="text-xs text-amber-600 mb-4">
            Essa é a última vez que dá pra adiar — no próximo acesso, vamos pedir pra concluir o cadastro antes de continuar.
          </p>
        )}
        <div className="flex gap-2">
          <Link
            href={href}
            onClick={() => setNavigating(true)}
            className={`flex-1 flex items-center justify-center gap-2 text-center px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors ${
              navigating ? 'opacity-80 pointer-events-none' : 'hover:bg-brand-600'
            }`}
          >
            {navigating ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Redirecionando...
              </>
            ) : (
              'Completar cadastro'
            )}
          </Link>
          {!blocking && (
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Depois
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
