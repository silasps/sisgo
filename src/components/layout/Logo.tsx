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
