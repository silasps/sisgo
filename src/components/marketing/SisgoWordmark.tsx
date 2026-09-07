export function SisgoSymbol({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Esfera */}
      <circle cx="50" cy="50" r="44" stroke="#F5F1E8" strokeWidth="2.5" fill="none" opacity="0.25" />
      {/* Anel orbital */}
      <ellipse cx="50" cy="50" rx="42" ry="16" stroke="#F5F1E8" strokeWidth="2" fill="none" opacity="0.15" strokeDasharray="5 7" />
      {/* S — arco superior */}
      <path d="M32 50 Q32 22 50 22 Q68 22 72 38" stroke="#F5F1E8" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* S — arco inferior */}
      <path d="M68 50 Q68 78 50 78 Q32 78 28 62" stroke="#1D6B67" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Ponte central */}
      <path d="M32 50 L68 50" stroke="#F5F1E8" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.35" />
    </svg>
  )
}

export function SisgoWordmark({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <SisgoSymbol size={size} />
      <span
        className="font-semibold tracking-[0.12em]"
        style={{ color: '#F5F1E8', fontSize: size * 0.55 }}
      >
        SISGO
      </span>
    </div>
  )
}
