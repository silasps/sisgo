export function getSupabaseCookieOptions(hostname?: string) {
  const isLocal = hostname
    ? hostname === 'localhost' || hostname.startsWith('127.')
    : typeof window !== 'undefined'
      ? window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.')
      : process.env.NODE_ENV !== 'production'

  return {
    secure: !isLocal,
    sameSite: 'lax' as const,
    path: '/',
  }
}
