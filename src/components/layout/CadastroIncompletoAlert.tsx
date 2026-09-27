'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, X } from 'lucide-react'

const DISMISS_KEY = 'sisgo:cadastro-incompleto-dismissed'
const COUNT_KEY_PREFIX = 'sisgo:cadastro-incompleto-count:'

// Quantas vezes a pessoa pode clicar "Depois" (por navegador/dispositivo,
// persistido em localStorage) antes do aviso virar bloqueante — sem X, sem
// "Depois", só resta completar o cadastro pra seguir usando o sistema.
const BLOCK_AFTER = 5

// Fechável até estourar BLOCK_AFTER (a pessoa pode adiar e seguir usando o
// sistema), mas volta a aparecer a cada novo login/sessão — por isso
// sessionStorage pro "já vi nesta sessão", não localStorage (que aqui só
// guarda a contagem de quantas vezes já adiou, entre sessões).
export function CadastroIncompletoAlert({ href }: { href: string }) {
  const [visible, setVisible] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [skipsUsed, setSkipsUsed] = useState(0)
  const [navigating, setNavigating] = useState(false)

  const countKey = `${COUNT_KEY_PREFIX}${href}`

  useEffect(() => {
    let dismissedThisSession = false
    try {
      dismissedThisSession = sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch { /* sessionStorage indisponível — mostra normalmente */ }

    let storedCount = 0
    try {
      storedCount = Number(localStorage.getItem(countKey) ?? '0') || 0
    } catch { /* localStorage indisponível — nunca bloqueia, só não conta */ }

    const isBlocking = storedCount >= BLOCK_AFTER
    if (!isBlocking && dismissedThisSession) return

    setSkipsUsed(storedCount)
    setBlocking(isBlocking)
    setVisible(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    try { localStorage.setItem(countKey, String(skipsUsed + 1)) } catch { /* ok ignorar */ }
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ok ignorar */ }
    setVisible(false)
  }

  if (!visible) return null

  const lastChance = !blocking && skipsUsed === BLOCK_AFTER - 1

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
