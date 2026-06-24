'use client'

import NextTopLoader from 'nextjs-toploader'

export function NavigationProgress() {
  return (
    <NextTopLoader
      color="#2FA09B"
      initialPosition={0.12}
      crawlSpeed={150}
      height={3}
      crawl
      showSpinner={false}
      easing="ease"
      speed={300}
      shadow="0 0 10px #2FA09B, 0 0 5px #2FA09B"
      zIndex={9999}
    />
  )
}
