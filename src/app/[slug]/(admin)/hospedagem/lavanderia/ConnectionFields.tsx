'use client'

import { useState } from 'react'
import { Cloud, Router, Info } from 'lucide-react'

type Props = {
  defaultMode?: string | null
  defaultIp?: string | null
  defaultAuth?: string | null
  defaultCloudServer?: string | null
  defaultCloudDeviceId?: string | null
  defaultCloudAuthKey?: string | null
}

export function ConnectionFields({
  defaultMode,
  defaultIp,
  defaultAuth,
  defaultCloudServer,
  defaultCloudDeviceId,
  defaultCloudAuthKey,
}: Props) {
  const [mode, setMode] = useState<'local' | 'cloud'>(defaultMode === 'cloud' ? 'cloud' : 'local')

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div className="sm:col-span-2 space-y-3">
      <input type="hidden" name="connection_mode" value={mode} />

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Como o sistema se conecta ao dispositivo?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('cloud')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              mode === 'cloud'
                ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Cloud size={16} className={mode === 'cloud' ? 'text-brand-500' : 'text-gray-400'} />
            <div>
              <p className={`text-xs font-medium ${mode === 'cloud' ? 'text-brand-700' : 'text-gray-700'}`}>Shelly Cloud</p>
              <p className="text-[10px] text-gray-400">Funciona de qualquer lugar</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              mode === 'local'
                ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Router size={16} className={mode === 'local' ? 'text-brand-500' : 'text-gray-400'} />
            <div>
              <p className={`text-xs font-medium ${mode === 'local' ? 'text-brand-700' : 'text-gray-700'}`}>IP local</p>
              <p className="text-[10px] text-gray-400">Servidor na mesma rede</p>
            </div>
          </button>
        </div>
      </div>

      {mode === 'cloud' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-600 leading-relaxed">
              Pegue esses dados no app <strong>Shelly Smart Control</strong> ou em <strong>control.shelly.cloud</strong>:
              o Server URI e a Auth Key ficam em Configurações → <strong>Chave de autorização na nuvem</strong>;
              o Device ID fica no dispositivo em Configurações → <strong>Informações do dispositivo</strong>.
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Server URI da conta Shelly</label>
            <input
              name="cloud_server"
              defaultValue={defaultCloudServer ?? ''}
              placeholder="https://shelly-151-eu.shelly.cloud"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Device ID</label>
            <input
              name="cloud_device_id"
              defaultValue={defaultCloudDeviceId ?? ''}
              placeholder="ex: a8032ab12345"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Auth Key (chave de autorização na nuvem)</label>
            <input
              name="cloud_auth_key"
              defaultValue={defaultCloudAuthKey ?? ''}
              placeholder="Cole aqui a chave gerada na conta Shelly"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>
          {/* Mantém o IP salvo mesmo quando o modo é cloud, como fallback */}
          <input type="hidden" name="device_ip" value={defaultIp ?? ''} />
          <input type="hidden" name="device_auth" value={defaultAuth ?? ''} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-600 leading-relaxed">
              O IP local só funciona se o servidor do sistema estiver <strong>na mesma rede WiFi</strong> do dispositivo.
              Para controlar pela internet de qualquer lugar, use o modo <strong>Shelly Cloud</strong>.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              name="device_ip"
              defaultValue={defaultIp ?? ''}
              placeholder="IP do dispositivo (ex: 192.168.1.100)"
              className={inputClass}
            />
            <input
              name="device_auth"
              defaultValue={defaultAuth ?? ''}
              placeholder="Senha (opcional)"
              className={inputClass}
            />
          </div>
          {/* Preserva credenciais cloud salvas quando o modo é local */}
          <input type="hidden" name="cloud_server" value={defaultCloudServer ?? ''} />
          <input type="hidden" name="cloud_device_id" value={defaultCloudDeviceId ?? ''} />
          <input type="hidden" name="cloud_auth_key" value={defaultCloudAuthKey ?? ''} />
        </div>
      )}
    </div>
  )
}
