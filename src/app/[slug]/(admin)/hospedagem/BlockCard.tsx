import Link from 'next/link'
import { Building2, BellRing } from 'lucide-react'

type Props = {
  href: string
  name: string
  floorCount: number
  roomCount: number
  occupiedBeds: number
  totalBeds: number
  hold?: { groupName: string } | null
}

export function BlockCard({ href, name, floorCount, roomCount, occupiedBeds, totalBeds, hold }: Props) {
  const pct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  return (
    <Link
      href={href}
      className="group bg-white rounded-xl border border-gray-200 p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={16} className="text-gray-400 shrink-0" />
          <p className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors truncate">{name}</p>
        </div>
        {hold && <BellRing size={14} className="text-amber-500 shrink-0" />}
      </div>

      <p className="text-xs text-gray-400">
        {floorCount} andar{floorCount !== 1 ? 'es' : ''} · {roomCount} quarto{roomCount !== 1 ? 's' : ''}
      </p>

      {hold && (
        <p className="text-[10px] font-medium text-amber-600 truncate">Reservado: {hold.groupName}</p>
      )}

      {totalBeds > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{occupiedBeds}/{totalBeds} camas ocupadas</span>
            <span className="font-medium">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Sem cama cadastrada</p>
      )}

      <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Abrir →
      </p>
    </Link>
  )
}
