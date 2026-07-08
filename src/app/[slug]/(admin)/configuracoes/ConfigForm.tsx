'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ConfigForm({
  action,
  buttonLabel,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>
  buttonLabel: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(formData: FormData) {
    setSaved(false)
    startTransition(async () => {
      await action(formData)
      router.refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form action={handleSubmit} className={className}>
      {children}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {isPending ? 'Salvando…' : buttonLabel}
        </button>
        {saved && !isPending && (
          <span className="text-sm text-green-600 font-medium">✓ Salvo</span>
        )}
      </div>
    </form>
  )
}
