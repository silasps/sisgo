'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { LogIn, LogOut } from 'lucide-react'
import { checkIn, checkOut } from './actions'

type CheckInProps = {
  personId: string
  orgId: string
  slug: string
  nome: string
}

type CheckOutProps = {
  presenceId: string
  slug: string
  nome: string
}

export function CheckInButton({ personId, orgId, slug, nome }: CheckInProps) {
  const [isPending, startTransition] = useTransition()

  function handleCheckIn() {
    const fd = new FormData()
    fd.set('person_id', personId)
    fd.set('org_id', orgId)
    fd.set('slug', slug)
    startTransition(async () => {
      await checkIn(fd)
      toast.success(`${nome} entrou na base`)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCheckIn}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors active:scale-95"
    >
      <LogIn size={14} aria-hidden />
      {isPending ? 'Aguarde…' : 'Check-in'}
    </button>
  )
}

export function CheckOutButton({ presenceId, slug, nome }: CheckOutProps) {
  const [isPending, startTransition] = useTransition()

  function handleCheckOut() {
    const fd = new FormData()
    fd.set('presence_id', presenceId)
    fd.set('slug', slug)
    startTransition(async () => {
      await checkOut(fd)
      toast.success(`${nome} saiu da base`)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCheckOut}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 text-gray-600 text-xs font-semibold rounded-lg transition-colors active:scale-95"
    >
      <LogOut size={14} aria-hidden />
      {isPending ? 'Aguarde…' : 'Check-out'}
    </button>
  )
}
