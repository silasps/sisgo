'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ScanBarcode, X, Keyboard, Loader2 } from 'lucide-react'

type Props = {
  onScan: (code: string) => void
  placeholder?: string
  className?: string
}

let detectorClassPromise: Promise<any> | null = null

function getDetectorClass(): Promise<any> {
  if (detectorClassPromise) return detectorClassPromise

  if (typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis) {
    // @ts-expect-error BarcodeDetector not in TS lib
    detectorClassPromise = Promise.resolve(globalThis.BarcodeDetector)
    return detectorClassPromise
  }

  detectorClassPromise = import('barcode-detector/pure').then(m => m.BarcodeDetector)
  return detectorClassPromise
}

function canUseCamera(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export function BarcodeScanner({ onScan, placeholder = 'Código de barras', className = '' }: Props) {
  const [mode, setMode] = useState<'idle' | 'scanning' | 'manual'>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const close = useCallback(() => {
    stopCamera()
    setMode('idle')
    setLoading(false)
    setError(null)
  }, [stopCamera])

  const handleDetection = useCallback((code: string) => {
    setLastCode(code)
    onScan(code)
    close()
  }, [onScan, close])

  useEffect(() => {
    if (mode !== 'scanning') return

    let cancelled = false
    let rafId: number

    async function startScanning() {
      try {
        setLoading(true)

        const [DetectorClass, stream] = await Promise.all([
          getDetectorClass(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          }),
        ])

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setLoading(false)

        const detector = new DetectorClass({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        })

        async function tick() {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
            if (!cancelled) rafId = requestAnimationFrame(tick)
            return
          }
          try {
            const results = await detector.detect(videoRef.current)
            if (results.length > 0 && !cancelled) {
              handleDetection(results[0].rawValue)
              return
            }
          } catch { /* frame not ready */ }
          if (!cancelled) rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
      } catch {
        if (!cancelled) {
          setLoading(false)
          setError('Não foi possível acessar a câmera. Verifique as permissões.')
          setMode('manual')
        }
      }
    }

    startScanning()
    return () => { cancelled = true; cancelAnimationFrame(rafId); stopCamera() }
  }, [mode, handleDetection, stopCamera])

  useEffect(() => {
    if (mode === 'manual') manualRef.current?.focus()
  }, [mode])

  if (mode === 'scanning') {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-gray-300 bg-black ${className}`}>
        <video ref={videoRef} className="w-full h-48 object-cover" muted playsInline />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="size-6 text-white animate-spin" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 h-16 border-2 border-white/60 rounded-lg" />
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={() => { close(); setMode('manual') }} className="p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70" title="Digitar manualmente">
            <Keyboard className="size-4" />
          </button>
          <button onClick={close} className="p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70" title="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">Aponte para o código de barras</p>
      </div>
    )
  }

  if (mode === 'manual') {
    return (
      <div className={`flex gap-2 ${className}`}>
        <input
          ref={manualRef}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim()
              if (val) handleDetection(val)
            }
          }}
        />
        {canUseCamera() && (
          <button onClick={() => setMode('scanning')} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors" title="Usar câmera">
            <ScanBarcode className="size-4 text-gray-600" />
          </button>
        )}
        <button onClick={close} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-xs text-gray-500">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {lastCode && (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
          <ScanBarcode className="size-3" /> {lastCode}
        </span>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => setMode(canUseCamera() ? 'scanning' : 'manual')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200 transition-colors"
      >
        <ScanBarcode className="size-3.5" />
        Escanear
      </button>
    </div>
  )
}
