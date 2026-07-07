type Props = {
  personName: string
  photoUrl: string | null
  orgName: string
  orgLogoUrl: string | null
  role: string
  active: boolean
  qrDataUrl: string
  className?: string
}

export function IdCard({ personName, photoUrl, orgName, orgLogoUrl, role, active, qrDataUrl, className = '' }: Props) {
  const initials = personName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white shadow-xl ${className}`}
      style={{ aspectRatio: '1.5858 / 1' }}
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-500 to-brand-600 px-[6%] py-[5%]">
          <div className="flex items-center gap-2 min-w-0">
            {orgLogoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={orgLogoUrl} alt={orgName} className="h-[22px] max-w-[90px] object-contain" />
            ) : (
              <span className="truncate text-xs font-bold text-white">{orgName}</span>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              active ? 'bg-white/20 text-white' : 'bg-black/20 text-white/80'
            }`}
          >
            {active ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-[4%] px-[6%] py-[4%]">
          <div className="flex h-[68%] aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoUrl} alt={personName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-gray-300">{initials}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-gray-900">{personName}</p>
            <p className="truncate text-xs font-medium text-brand-600">{role}</p>
            <p className="mt-1 truncate text-[10px] text-gray-400">{orgName}</p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR de verificação" className="h-[68%] aspect-square shrink-0 rounded-md" />
        </div>
      </div>
    </div>
  )
}
