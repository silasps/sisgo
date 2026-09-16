import Link from 'next/link'
import { clearRolePreview, ROLE_PREVIEW_OPTIONS, setRolePreview, type RolePreview } from '@/lib/role-preview'
import { RolePreviewForm } from './RolePreviewForm'

type Props = {
  mode: 'admin' | 'public'
  slug: string
  baseName: string
  preview?: RolePreview | null
  schools?: Array<{ id: string; name: string }>
  ministries?: Array<{ id: string; name: string }>
}

export function SuperAdminContextBar({ mode, slug, baseName, preview, schools = [], ministries = [] }: Props) {
  if (mode === 'admin') {
    const previewLabel = ROLE_PREVIEW_OPTIONS.find(option => option.value === preview?.role)?.label
    const dashboardPath = `/${slug}/dashboard`

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 bg-gray-900 text-white text-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/superadmin"
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors font-medium shrink-0"
          >
            ← Início
          </Link>
          <span className="text-gray-600 shrink-0">|</span>
          <span className="text-gray-300 truncate min-w-0">{baseName}</span>
          {preview && (
            <span className="hidden md:inline-flex shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-200">
              Visualizando como: {previewLabel ?? preview.role}
            </span>
          )}
        </div>
        <RolePreviewForm
          action={setRolePreview}
          preview={preview}
          schools={schools}
          ministries={ministries}
          redirectTo={dashboardPath}
        />
        {preview && (
          <form action={clearRolePreview} className="shrink-0">
            <input type="hidden" name="redirect_to" value={dashboardPath} />
            <button type="submit" className="h-7 rounded-md border border-white/10 px-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
              Sair
            </button>
          </form>
        )}
        <Link
          href={`/${slug}?preview=true`}
          className="hidden items-center gap-1 text-gray-400 hover:text-white transition-colors sm:flex shrink-0"
        >
          Ver como público →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white text-xs">
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
