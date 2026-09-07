import Link from 'next/link'
import { BellRing } from 'lucide-react'

const DEST_LABEL: Record<string, string> = { visita: 'Visitantes', aluno: 'Alunos', obreiro: 'Obreiros' }
const GENDER_LABEL: Record<string, { label: string; cls: string }> = {
  masculino: { label: 'Masc.', cls: 'bg-blue-100 text-blue-700' },
  feminino:  { label: 'Fem.',  cls: 'bg-pink-100 text-pink-700' },
  misto:     { label: 'Misto', cls: 'bg-purple-100 text-purple-700' },
}

type Props = {
  href: string
  name: string
  destination: string | null
  genderConstraint: string | null
  roomCount: number
  occupiedBeds: number
  totalBeds: number
  hold?: { groupName: string } | null
}

export function FloorCard({ href, name, destination, genderConstraint, roomCount, occupiedBeds, totalBeds, hold }: Props) {
  const pct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
  const gender = genderConstraint ? GENDER_LABEL[genderConstraint] : null

  return (
    <Link
      href={href}
      className="group bg-white rounded-xl border border-gray-200 p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors truncate">{name}</p>
        {hold && <BellRing size={14} className="text-amber-500 shrink-0" />}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {destination && (
          <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            {DEST_LABEL[destination]}
          </span>
        )}
        {gender && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gender.cls}`}>{gender.label}</span>
        )}
        <span className="text-[10px] text-gray-400">{roomCount} quarto{roomCount !== 1 ? 's' : ''}</span>
      </div>

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
