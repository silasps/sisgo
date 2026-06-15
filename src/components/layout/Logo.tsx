import Image from 'next/image'

type LogoProps = {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 80, md: 120, lg: 160 }

export function Logo({ variant = 'light', size = 'md' }: LogoProps) {
  const w = sizes[size]
  const src = variant === 'light' ? '/images/logo-white.png' : '/images/logo.png'

  return (
    <Image
      src={src}
      alt="JOCUM Almirante Tamandaré"
      width={w}
      height={Math.round(w * 0.35)}
      priority
      className="object-contain"
    />
  )
}

export function SisgoLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
        <circle cx="50" cy="50" r="44" stroke="#F5F1E8" strokeWidth="2.5" fill="none" opacity="0.25" />
        <ellipse cx="50" cy="50" rx="42" ry="16" stroke="#F5F1E8" strokeWidth="2" fill="none" opacity="0.15" strokeDasharray="5 7" />
        <path d="M32 50 Q32 22 50 22 Q68 22 72 38" stroke="#F5F1E8" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M68 50 Q68 78 50 78 Q32 78 28 62" stroke="#1D6B67" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M32 50 L68 50" stroke="#F5F1E8" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.35" />
      </svg>
      <span style={{ color: '#F5F1E8', fontSize: size * 0.52, fontWeight: 600, letterSpacing: '0.12em' }}>
        SISGO
      </span>
    </div>
  )
}
