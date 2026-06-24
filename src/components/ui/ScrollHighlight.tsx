'use client'

import { useEffect } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'

export function ScrollHighlight() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return

    const timer = setTimeout(() => {
      const el = document.getElementById(`item-${highlightId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-pulse')
        setTimeout(() => el.classList.remove('highlight-pulse'), 2500)
      }
      const params = new URLSearchParams(searchParams.toString())
      params.delete('highlight')
      const query = params.toString()
      router.replace(pathname + (query ? `?${query}` : ''), { scroll: false })
    }, 400)

    return () => clearTimeout(timer)
  }, [searchParams, pathname, router])

  return null
}
