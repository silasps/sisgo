export function getSupabaseCookieOptions(hostname: string) {
  const isLocalhost = hostname === 'localhost' || hostname.startsWith('127.')
  return {
    secure: !isLocalhost,
    sameSite: 'lax' as const,
    path: '/',
  }
}
