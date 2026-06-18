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
      <div className="flex items-center gap-3 px-4 py-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] bg-gray-900 text-white text-xs shrink-0 z-50">
        <Link
          href="/superadmin"
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors font-medium"
        >
          ← Início
        </Link>
        <span className="text-gray-600">|</span>
        <span className="text-gray-300 truncate">{baseName}</span>
        {preview && (
          <span className="hidden md:inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-200">
            Visualizando como: {previewLabel ?? preview.role}
          </span>
        )}
        <RolePreviewForm
          action={setRolePreview}
          preview={preview}
          schools={schools}
          ministries={ministries}
          redirectTo={dashboardPath}
        />
        {preview && (
          <form action={clearRolePreview}>
            <input type="hidden" name="redirect_to" value={dashboardPath} />
            <button type="submit" className="h-7 rounded-md border border-white/10 px-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
              Sair
            </button>
          </form>
        )}
        <Link
          href={`/${slug}?preview=true`}
          className="hidden items-center gap-1 text-gray-400 hover:text-white transition-colors sm:flex"
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
