'use client'

import { useEffect } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function FlashToast() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const success = searchParams.get('flash_success')
    const error = searchParams.get('flash_error')
    const info = searchParams.get('flash_info')

    if (!success && !error && !info) return

    if (success) toast.success(success)
    if (error) toast.error(error)
    if (info) toast.info(info)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('flash_success')
    params.delete('flash_error')
    params.delete('flash_info')
    const query = params.toString()
    router.replace(pathname + (query ? `?${query}` : ''))
  }, [searchParams, pathname, router])

  return null
}
