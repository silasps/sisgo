'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Wifi, HelpCircle, X, Wrench, AlertTriangle, ShieldCheck } from 'lucide-react'

type DeviceOption = {
  id: string
  label: string
  brand: string
  model: string
  setup_instructions?: string | null
  difficulty?: string
}

const difficultyConfig: Record<string, { label: string; badge: string; dot: string }> = {
  easy:     { label: 'Fácil',       badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  medium:   { label: 'Intermediário', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  advanced: { label: 'Avançado',     badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
}

type Props = {
  name: string
  devices: DeviceOption[]
  defaultValue?: string | null
}

function SetupModal({ device, onClose }: { device: DeviceOption; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50">
              <Wrench size={18} className="text-brand-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Como instalar</h3>
              <p className="text-xs text-gray-400">{device.brand} — {device.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Instructions */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {device.setup_instructions ? (
            <div className="space-y-3">
              {device.setup_instructions.split('\n').map((line, i) => {
                const trimmed = line.trim()
                if (!trimmed) return null

                const stepMatch = trimmed.match(/^(\d+)\.\s*(.+)/)
                if (stepMatch) {
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {stepMatch[1]}
                      </div>
                      <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                        {renderInlineCode(stepMatch[2])}
                      </div>
                    </div>
                  )
                }

                if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                  return (
                    <div key={i} className="ml-9 flex gap-2">
                      <span className="text-brand-400 mt-1">•</span>
                      <span className="text-sm text-gray-600">{renderInlineCode(trimmed.slice(1).trim())}</span>
                    </div>
                  )
                }

                return (
                  <p key={i} className="text-sm text-gray-600 ml-9">{renderInlineCode(trimmed)}</p>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <HelpCircle size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Instruções não disponíveis para este modelo.</p>
              <p className="text-xs text-gray-300 mt-1">Consulte o manual do fabricante.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-brand-600">{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export function DeviceSelect({ name, devices, defaultValue }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(defaultValue ?? '')
  const [showSetup, setShowSetup] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = devices.filter(d =>
    `${d.brand} ${d.model} ${d.label}`.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, DeviceOption[]>>((acc, d) => {
    if (!acc[d.brand]) acc[d.brand] = []
    acc[d.brand].push(d)
    return acc
  }, {})

  const selectedDevice = devices.find(d => d.id === selected)

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected} />

      {/* Select button */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Wifi size={14} className={selected ? 'text-green-500' : 'text-gray-300'} />
            <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
              {selectedDevice ? selectedDevice.label : 'Selecione o dispositivo smart'}
            </span>
            {selectedDevice?.difficulty && (
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${difficultyConfig[selectedDevice.difficulty]?.badge ?? ''}`}>
                {difficultyConfig[selectedDevice.difficulty]?.label}
              </span>
            )}
          </div>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </button>

        {/* Setup instructions button */}
        {selectedDevice && (
          <button
            type="button"
            onClick={() => setShowSetup(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Como instalar?</span>
          </button>
        )}
      </div>

      {/* Alerta para dispositivos que precisam de configuração extra */}
      {selectedDevice && selectedDevice.difficulty === 'easy' && (
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <ShieldCheck size={16} className="text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-green-700">Pronto para usar</p>
            <p className="text-[10px] text-green-600">
              Este dispositivo funciona de fábrica com controle de tempo automático. Basta configurar o WiFi, anotar o IP e cadastrar no sistema.
            </p>
          </div>
        </div>
      )}

      {selectedDevice && selectedDevice.difficulty === 'medium' && (
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700">Configuração obrigatória do timer</p>
            <p className="text-[10px] text-amber-600">
              Este dispositivo precisa do firmware <strong>Tasmota</strong> e de uma regra de timer configurada manualmente.
              Sem essa configuração, a máquina <strong>liga mas não desliga sozinha</strong> quando o tempo acabar.
            </p>
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="mt-1.5 text-[10px] font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Ver instruções completas →
            </button>
          </div>
        </div>
      )}

      {selectedDevice && selectedDevice.difficulty === 'advanced' && (
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-700">Requer instalação de firmware + configuração do timer</p>
            <p className="text-[10px] text-red-600">
              Este dispositivo usa nuvem de fábrica e <strong>não funciona</strong> com controle local.
              É necessário instalar o firmware <strong>Tasmota</strong> (processo técnico que pode exigir solda)
              e configurar a regra de timer manualmente. Sem isso, a máquina não será controlada pelo sistema.
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSetup(true)}
                className="text-[10px] font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
              >
                Ver instruções completas →
              </button>
              <span className="text-[10px] text-red-400">
                Alternativa mais simples: use um Shelly (funciona de fábrica)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar marca ou modelo..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-300"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {Object.entries(grouped).length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">
                Nenhum dispositivo encontrado
              </div>
            )}
            {Object.entries(grouped).map(([brand, items]) => (
              <div key={brand}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                  {brand}
                </div>
                {items.map(d => {
                  const diff = difficultyConfig[d.difficulty ?? 'medium']
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { setSelected(d.id); setOpen(false); setSearch('') }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center justify-between gap-2 ${
                        selected === d.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${diff.dot}`} />
                        <span className="truncate">{d.model}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.difficulty === 'easy' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-600">RECOMENDADO</span>
                        )}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${diff.badge}`}>{diff.label}</span>
                        {d.setup_instructions && (
                          <HelpCircle size={11} className="text-gray-300" />
                        )}
                        {selected === d.id && (
                          <span className="text-[10px] text-brand-500">✓</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup modal */}
      {showSetup && selectedDevice && (
        <SetupModal device={selectedDevice} onClose={() => setShowSetup(false)} />
      )}
    </div>
  )
}
