import Link from 'next/link'

type Props = {
  mode: 'admin' | 'public'
  slug: string
  baseName: string
}

export function SuperAdminContextBar({ mode, slug, baseName }: Props) {
  if (mode === 'admin') {
    return (
      <div className="flex items-center gap-3 px-4 h-9 bg-gray-900 text-white text-xs shrink-0 z-50">
        <Link
          href="/superadmin"
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors font-medium"
        >
          ← Início
        </Link>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 truncate">{baseName}</span>
        <Link
          href={`/${slug}?preview=true`}
          className="ml-auto flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          Ver como público →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white text-xs z-50">
      <span className="text-gray-400">Visualizando página pública</span>
      <Link
        href={`/${slug}/pessoas`}
        className="ml-auto flex items-center gap-1 text-brand-400 hover:text-brand-300 font-medium transition-colors"
      >
        Entrar na gestão →
      </Link>
    </div>
  )
}
