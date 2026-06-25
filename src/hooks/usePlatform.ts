'use client'

import { useState, useEffect } from 'react'

export type Platform = 'ios' | 'android' | 'web'

let cached: Platform | null = null

function detect(): Platform {
  if (cached) return cached

  if (typeof window === 'undefined') {
    cached = 'web'
    return 'web'
  }

  const ua = navigator.userAgent

  if (/iPad|iPhone|iPod/.test(ua)) {
    cached = 'ios'
    return 'ios'
  }

  if (/Android/.test(ua)) {
    cached = 'android'
    return 'android'
  }

  // iPad desktop mode or modified UA — WebKit-only CSS feature + touch
  if (
    typeof CSS !== 'undefined' &&
    CSS.supports('-webkit-touch-callout', 'none') &&
    navigator.maxTouchPoints > 1
  ) {
    cached = 'ios'
    return 'ios'
  }

  // Mac user-agent with touch = iPad in desktop mode
  if (/Mac/.test(ua) && navigator.maxTouchPoints > 1) {
    cached = 'ios'
    return 'ios'
  }

  cached = 'web'
  return 'web'
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web')

  useEffect(() => {
    const p = detect()
    setPlatform(p)
    document.documentElement.dataset.platform = p
  }, [])

  return platform
}
