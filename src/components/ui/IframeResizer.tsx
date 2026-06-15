'use client'

import { useEffect, useRef } from 'react'

export function IframeResizer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function sendHeight() {
      const h = ref.current?.scrollHeight ?? document.body.scrollHeight
      window.parent.postMessage({ type: 'sisgo-height', height: h + 24 }, '*')
    }

    sendHeight()
    const observer = new ResizeObserver(sendHeight)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref}>{children}</div>
}
