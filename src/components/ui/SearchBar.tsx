'use client'

import { useRef, useTransition } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function SearchBar({
  placeholder = 'Buscar…',
  className,
}: {
  placeholder?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      startTransition(() => {
        router.replace(pathname + '?' + params.toString())
      })
    }, 300)
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        aria-hidden
      />
      <input
        type="search"
        defaultValue={searchParams.get('q') ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        className={`pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-full transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent ${
          isPending ? 'opacity-60' : 'opacity-100'
        }`}
      />
    </div>
  )
}
