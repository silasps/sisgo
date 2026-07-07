'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { generateCardToken, revokeCardToken, updatePersonPhoto } from './actions'

type Props = {
  orgId: string
  personId: string
  slug: string
  hasToken: boolean
  photoUrl: string | null
}

export function CardActions({ orgId, personId, slug, hasToken, photoUrl }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      await generateCardToken(orgId, personId, slug)
      router.refresh()
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeCardToken(orgId, personId, slug)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <form action={updatePersonPhoto.bind(null, orgId, personId, slug)} className="space-y-3">
        <ImageUpload
          name="photo_url"
          label="Foto da pessoa"
          bucket="person-photos"
          folder={`people/${personId}`}
          defaultUrl={photoUrl}
        />
        <button
          type="submit"
          className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Salvar foto
        </button>
      </form>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {hasToken ? 'Gerar novo QR (revoga o atual)' : 'Gerar carteirinha'}
        </button>
        {hasToken && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Revogar acesso público
          </button>
        )}
      </div>
    </div>
  )
}
