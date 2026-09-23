'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

const DISMISS_KEY = 'sisgo:cadastro-incompleto-dismissed'

// Fechável (a pessoa pode adiar e seguir usando o sistema), mas volta a
// aparecer a cada novo login/sessão — por isso sessionStorage, não
// localStorage, pro dismiss não "grudar" pra sempre.
export function CadastroIncompletoAlert({ href }: { href: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    } catch { /* sessionStorage indisponível — mostra normalmente */ }
    setVisible(true)
  }, [])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ok ignorar */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 relative">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <AlertTriangle className="size-5" />
          <h2 className="font-semibold text-gray-900">Cadastro incompleto</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Seu cadastro ainda não foi concluído. Você pode continuar usando o sistema por
          enquanto, mas complete assim que puder — dá pra fazer aos poucos, em várias visitas.
        </p>
        <div className="flex gap-2">
          <Link
            href={href}
            className="flex-1 text-center px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
          >
            Completar cadastro
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  )
}
