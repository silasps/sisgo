'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Lang } from '@/lib/i18n/forms'

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'pt', label: 'PT' },
  { lang: 'en', label: 'EN' },
  { lang: 'es', label: 'ES' },
]

// Seletor discreto no topo da página pública — troca ?lang= na URL, que
// comanda tanto o conteúdo renderizado no servidor (hero, descrições) quanto
// o formulário inline (RegistrationForm usa key={lang} na page, remontando
// com o idioma novo em vez de ficar preso no que tinha ao montar).
export function LangNavSwitcher({ lang }: { lang: Lang }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setLang(l: Lang) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('lang', l)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-1 text-[11px] text-white/50 flex-shrink-0">
      {OPTIONS.map((o, i) => (
        <span key={o.lang} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/20">·</span>}
          <button
            type="button"
            onClick={() => setLang(o.lang)}
            aria-current={lang === o.lang}
            className={lang === o.lang ? 'text-white font-semibold' : 'hover:text-white/80 transition-colors'}
          >
            {o.label}
          </button>
        </span>
      ))}
    </div>
  )
}
