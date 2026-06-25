'use client'

import { useState, useEffect } from 'react'

export type Platform = 'ios' | 'android' | 'web'

let cachedPlatform: Platform | null = null

function detectPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require('@capacitor/core')
    const p = Capacitor.getPlatform()
    if (p === 'ios' || p === 'android') {
      cachedPlatform = p
      return p
    }
  } catch {
    // Capacitor not available — fallback to user-agent
  }

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1)) {
      cachedPlatform = 'ios'
      return 'ios'
    }
    if (/Android/.test(ua)) {
      cachedPlatform = 'android'
      return 'android'
    }
  }

  cachedPlatform = 'web'
  return 'web'
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web')

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)
    document.documentElement.dataset.platform = detected
  }, [])

  return platform
}
