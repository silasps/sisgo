import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { startMachine, stopMachine, createMachine, updateMachine, deleteMachine, upsertPricing, toggleLaundryEnabled, checkMachinesOnline, createDeviceModel, deleteDeviceModel, testDeviceConnection, testMachineConnection } from './actions'
import { WashingMachine, Power, PowerOff, Plus, Settings, History, Pencil, Trash2, DollarSign, Timer, Wifi, WifiOff, Cpu, Info, Cloud } from 'lucide-react'
import { DeviceSelect } from './DeviceSelect'
import { ConnectionFields } from './ConnectionFields'
import { SessionCountdown } from './SessionCountdown'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string; tab?: string }>
}

export default async function LavanderiaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg, tab } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, laundry_enabled').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  const realRole = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const preview  = await getRolePreview(realRole)
  const role     = preview?.role ?? realRole

  if (!isManagementRole(role) && !canSeeHospedagem(role)) notFound()

  const laundryEnabled = (org as { laundry_enabled?: boolean }).laundry_enabled ?? false

  // ── Data ────────────────────────────────────────────────────────────────────
  const [{ data: machines }, { data: pricing }, { data: sessions }, { data: todaySessions }] = await Promise.all([
    sbAdmin.from('laundry_machines')
      .select('*')
      .eq('organization_id', org.id)
      .order('name'),
    sbAdmin.from('laundry_pricing')
      .select('*')
      .eq('organization_id', org.id)
      .eq('active', true),
    sbAdmin.from('laundry_sessions')
      .select('*')
      .eq('organization_id', org.id)
      .eq('status', 'running')
      .order('started_at', { ascending: false }),
    sbAdmin.from('laundry_sessions')
      .select('amount_paid, status')
      .eq('organization_id', org.id)
      .gte('created_at', new Date().toISOString().split('T')[0]),
  ])

  type MachineRow = {
    id: string; name: string; type: string; location: string | null
    status: string; device_type: string | null; device_ip: string | null; device_auth: string | null
    connection_mode: string | null; cloud_server: string | null
    cloud_device_id: string | null; cloud_auth_key: string | null
    created_at: string; updated_at: string
  }
  type PricingRow = {
    id: string; machine_type: string; price_per_minute_cents: number
    min_minutes: number; max_minutes: number; step_minutes: number
  }
  type SessionRow = {
    id: string; machine_id: string; guest_name: string | null; person_id: string | null
    duration_minutes: number; amount_paid: number; payment_method: string
    status: string; started_at: string; expected_end_at: string
  }

  // ── Auto-completar sessões expiradas ──────────────────────────────────────
  const now = new Date().toISOString()
  const expiredSessions = ((sessions ?? []) as Array<{ id: string; machine_id: string; expected_end_at: string; status: string }>)
    .filter(s => s.status === 'running' && s.expected_end_at && new Date(s.expected_end_at) <= new Date())
  if (expiredSessions.length > 0) {
    await Promise.all(expiredSessions.map(async (s) => {
      await sbAdmin.from('laundry_sessions').update({ status: 'completed', actual_end_at: now }).eq('id', s.id)
      await sbAdmin.from('laundry_machines').update({ status: 'available', updated_at: now }).eq('id', s.machine_id)
    }))
  }

  const expiredIds = new Set(expiredSessions.map(s => s.id))
  const expiredMachineIds = new Set(expiredSessions.map(s => s.machine_id))

  const machinesList  = ((machines ?? []) as MachineRow[]).map(m =>
    expiredMachineIds.has(m.id) ? { ...m, status: 'available' } : m
  )
  const pricingList   = (pricing ?? []) as PricingRow[]
  const runningSessions = ((sessions ?? []) as SessionRow[]).filter(s => !expiredIds.has(s.id))
  const todayList     = (todaySessions ?? []) as Array<{ amount_paid: number; status: string }>

  const sessionMap = new Map(runningSessions.map(s => [s.machine_id, s]))
  const pricingMap = new Map(pricingList.map(p => [p.machine_type, p]))

  // ── Verificar conectividade dos Shellys ─────────────────────────────────────
  const onlineStatus = await checkMachinesOnline(
    machinesList.map(m => ({
      id: m.id, device_ip: m.device_ip, device_type: m.device_type,
      connection_mode: m.connection_mode, cloud_server: m.cloud_server,
      cloud_device_id: m.cloud_device_id, cloud_auth_key: m.cloud_auth_key,
    }))
  )

  const hasDevice = (m: MachineRow) =>
    m.connection_mode === 'cloud'
      ? !!(m.cloud_server && m.cloud_device_id && m.cloud_auth_key)
      : !!m.device_ip

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalMachines = machinesList.length
  const inUse = machinesList.filter(m => m.status === 'in_use').length
  const available = machinesList.filter(m => m.status === 'available').length
  const todayRevenue = todayList
    .filter(s => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.amount_paid, 0)
  const { data: deviceModelsData } = await sbAdmin.from('laundry_device_models')
    .select('id, brand, model, label, setup_instructions, difficulty, display_order')
    .or(`is_global.eq.true,organization_id.eq.${org.id}`)
    .order('display_order')
    .order('brand')
  const deviceModels = (deviceModelsData ?? []) as Array<{ id: string; brand: string; model: string; label: string; setup_instructions: string | null; difficulty: string; display_order: number }>
  const deviceOptions = deviceModels.map(d => ({ id: d.id, label: d.label, brand: d.brand, model: d.model, setup_instructions: d.setup_instructions, difficulty: d.difficulty }))
  const activeTab = tab === 'maquinas' ? 'maquinas' : tab === 'precos' ? 'precos' : tab === 'dispositivos' ? 'dispositivos' : 'dashboard'

  // ── Server actions ──────────────────────────────────────────────────────────
  const handleStartMachine = async (formData: FormData) => {
    'use server'
    const machineId = formData.get('machine_id') as string
    const machine = machinesList.find(m => m.id === machineId)
    if (!machine) return
    const p = pricingMap.get(machine.type)
    const minutes = parseInt(formData.get('duration_minutes') as string)
    if (isNaN(minutes) || minutes < 1) return
    const amount = p ? minutes * p.price_per_minute_cents : 0

    await startMachine({
      organizationId: org.id,
      machineId,
      durationMinutes: minutes,
      amountPaid: amount,
      paymentMethod: (formData.get('payment_method') as string) || 'cash',
      guestName: (formData.get('guest_name') as string)?.trim() || null,
      personId: null,
      pricingId: p?.id ?? null,
      notes: null,
      createdBy: user.id,
    })
    redirect(`/${slug}/hospedagem/lavanderia?msg=liberada`)
  }

  const handleStopMachine = async (formData: FormData) => {
    'use server'
    await stopMachine({
      sessionId: formData.get('session_id') as string,
      machineId: formData.get('machine_id') as string,
      organizationId: org.id,
    })
    redirect(`/${slug}/hospedagem/lavanderia?msg=parada`)
  }

  const handleToggleEnabled = async () => {
    'use server'
    await toggleLaundryEnabled(org.id, !laundryEnabled)
    redirect(`/${slug}/hospedagem/lavanderia?msg=${laundryEnabled ? 'desativada' : 'ativada'}`)
  }

  const handleCreateMachine = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await createMachine({
      organizationId: org.id,
      name,
      type: formData.get('type') as string,
      location: (formData.get('location') as string)?.trim() || null,
      deviceType: (formData.get('device_type') as string)?.trim() || null,
      deviceIp: (formData.get('device_ip') as string)?.trim() || null,
      deviceAuth: (formData.get('device_auth') as string)?.trim() || null,
      connectionMode: (formData.get('connection_mode') as string)?.trim() || null,
      cloudServer: (formData.get('cloud_server') as string)?.trim() || null,
      cloudDeviceId: (formData.get('cloud_device_id') as string)?.trim() || null,
      cloudAuthKey: (formData.get('cloud_auth_key') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=maquinas&msg=criada`)
  }

  const handleUpdateMachine = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await updateMachine({
      id: formData.get('id') as string,
      organizationId: org.id,
      name,
      type: formData.get('type') as string,
      location: (formData.get('location') as string)?.trim() || null,
      status: formData.get('status') as string,
      deviceType: (formData.get('device_type') as string)?.trim() || null,
      deviceIp: (formData.get('device_ip') as string)?.trim() || null,
      deviceAuth: (formData.get('device_auth') as string)?.trim() || null,
      connectionMode: (formData.get('connection_mode') as string)?.trim() || null,
      cloudServer: (formData.get('cloud_server') as string)?.trim() || null,
      cloudDeviceId: (formData.get('cloud_device_id') as string)?.trim() || null,
      cloudAuthKey: (formData.get('cloud_auth_key') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=maquinas&msg=atualizada`)
  }

  const handleDeleteMachine = async (formData: FormData) => {
    'use server'
    await deleteMachine({
      id: formData.get('id') as string,
      organizationId: org.id,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=maquinas&msg=removida`)
  }

  const handleSavePricing = async (formData: FormData) => {
    'use server'
    const priceReais = parseFloat(formData.get('price_per_minute') as string)
    if (isNaN(priceReais) || priceReais < 0) return
    await upsertPricing({
      id: (formData.get('pricing_id') as string) || null,
      organizationId: org.id,
      machineType: formData.get('machine_type') as string,
      pricePerMinuteCents: Math.round(priceReais * 100),
      minMinutes: parseInt(formData.get('min_minutes') as string) || 15,
      maxMinutes: parseInt(formData.get('max_minutes') as string) || 180,
      stepMinutes: parseInt(formData.get('step_minutes') as string) || 15,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=precos&msg=preco_salvo`)
  }

  const handleCreateDeviceModel = async (formData: FormData) => {
    'use server'
    const brand = (formData.get('brand') as string).trim()
    const model = (formData.get('model') as string).trim()
    if (!brand || !model) return
    const id = `custom_${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
    await createDeviceModel({
      id,
      organizationId: org.id,
      brand,
      model,
      label: `${brand} ${model}`,
      startUrlTemplate: (formData.get('start_url') as string).trim(),
      stopUrlTemplate: (formData.get('stop_url') as string).trim(),
      statusUrlTemplate: (formData.get('status_url') as string).trim(),
      setupInstructions: (formData.get('setup_instructions') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=dispositivos&msg=dispositivo_criado`)
  }

  const handleDeleteDeviceModel = async (formData: FormData) => {
    'use server'
    await deleteDeviceModel({
      id: formData.get('id') as string,
      organizationId: org.id,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=dispositivos&msg=dispositivo_removido`)
  }

  const handleTestConnection = async (formData: FormData) => {
    'use server'
    const ip = (formData.get('device_ip') as string).trim()
    const deviceType = (formData.get('device_type') as string)?.trim() || null
    if (!ip) return
    const result = await testDeviceConnection({ deviceIp: ip, deviceType })
    redirect(`/${slug}/hospedagem/lavanderia?tab=maquinas&msg=${result.ok ? 'conexao_ok' : 'conexao_falhou'}`)
  }

  const handleTestMachine = async (formData: FormData) => {
    'use server'
    const result = await testMachineConnection({
      machineId: formData.get('id') as string,
      organizationId: org.id,
    })
    redirect(`/${slug}/hospedagem/lavanderia?tab=maquinas&msg=${result.ok ? 'conexao_ok' : 'conexao_falhou'}`)
  }

  const msgInfo: Record<string, string> = {
    liberada:    'Máquina liberada com sucesso.',
    parada:      'Máquina parada.',
    criada:      'Máquina cadastrada com sucesso.',
    atualizada:  'Máquina atualizada.',
    removida:    'Máquina removida.',
    preco_salvo: 'Preço atualizado.',
    ativada:     'Lavanderia ativada. O módulo agora aparece no menu.',
    desativada:  'Lavanderia desativada. O módulo foi removido do menu.',
    dispositivo_criado:  'Modelo de dispositivo cadastrado.',
    dispositivo_removido: 'Modelo de dispositivo removido.',
    conexao_ok:  'Conexão com o dispositivo OK!',
    conexao_falhou: 'Falha na conexão — verifique os dados da conexão (IP local ou Shelly Cloud) e se o dispositivo está ligado e com internet.',
  }

  const formatCents = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const statusLabel: Record<string, string> = {
    available: 'Disponível',
    in_use: 'Em uso',
    maintenance: 'Manutenção',
    offline: 'Offline',
  }

  const statusColor: Record<string, string> = {
    available: 'bg-green-100 text-green-700 border-green-200',
    in_use: 'bg-blue-100 text-blue-700 border-blue-200',
    maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    offline: 'bg-gray-100 text-gray-500 border-gray-200',
  }

  const typeLabel: Record<string, string> = { washer: 'Lavadora', dryer: 'Secadora' }

  return (
    <>
      <Header title="Lavanderia" />
      <main className="p-4 md:p-6 space-y-5 max-w-6xl">
        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
          </div>
        )}

        {/* Toggle ativar/desativar */}
        <div className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
          laundryEnabled
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {laundryEnabled ? 'Lavanderia ativada' : 'Lavanderia desativada'}
            </p>
            <p className="text-[10px] text-gray-400">
              {laundryEnabled
                ? 'O módulo aparece no menu da hospitalidade.'
                : 'Ative para que a lavanderia apareça no menu e possa ser usada.'}
            </p>
          </div>
          <form action={handleToggleEnabled}>
            <button
              type="submit"
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                laundryEnabled
                  ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {laundryEnabled ? 'Desativar' : 'Ativar'}
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { key: 'dashboard', label: 'Painel', icon: WashingMachine },
            { key: 'maquinas', label: 'Máquinas', icon: Settings },
            { key: 'precos', label: 'Preços', icon: DollarSign },
            { key: 'dispositivos', label: 'Dispositivos', icon: Cpu },
          ] as const).map(t => (
            <Link
              key={t.key}
              href={`/${slug}/hospedagem/lavanderia${t.key === 'dashboard' ? '' : `?tab=${t.key}`}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                activeTab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </Link>
          ))}
          <Link
            href={`/${slug}/hospedagem/lavanderia/historico`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors flex-1 justify-center"
          >
            <History size={14} />
            Histórico
          </Link>
        </div>

        {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Máquinas', value: totalMachines, color: 'text-gray-600' },
                { label: 'Disponíveis', value: available, color: 'text-green-600' },
                { label: 'Em uso', value: inUse, color: 'text-blue-600' },
                { label: 'Receita hoje', value: formatCents(todayRevenue), color: 'text-emerald-600' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Machine Cards */}
            {machinesList.length === 0 ? (
              <EmptyState
                icon={WashingMachine}
                title="Nenhuma máquina cadastrada"
                description="Cadastre suas máquinas de lavar e secar para começar."
                cta={{ label: 'Cadastrar máquina', href: `/${slug}/hospedagem/lavanderia?tab=maquinas` }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {machinesList.map(machine => {
                  const session = sessionMap.get(machine.id)
                  const p = pricingMap.get(machine.type)
                  const isRunning = machine.status === 'in_use' && session
                  const isOnline = onlineStatus[machine.id] ?? false
                  const connected = hasDevice(machine)
                  const canStart = machine.status === 'available' && connected && isOnline

                  return (
                    <div
                      key={machine.id}
                      className={`bg-white rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-md ${
                        isRunning ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <WashingMachine size={18} className={isRunning ? 'text-blue-500' : 'text-gray-400'} />
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{machine.name}</h3>
                            <p className="text-[10px] text-gray-400">{typeLabel[machine.type]}{machine.location ? ` · ${machine.location}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {machine.connection_mode === 'cloud' && connected && (
                            <Cloud size={12} className={isOnline ? 'text-blue-400' : 'text-gray-300'} />
                          )}
                          {connected ? (
                            isOnline ? (
                              <Wifi size={12} className="text-green-500" />
                            ) : (
                              <WifiOff size={12} className="text-red-400" />
                            )
                          ) : (
                            <WifiOff size={12} className="text-gray-300" />
                          )}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor[machine.status]}`}>
                            {statusLabel[machine.status]}
                          </span>
                        </div>
                      </div>

                      {/* Running session info */}
                      {isRunning && session && (
                        <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-blue-600 font-medium">
                              {session.guest_name || 'Uso anônimo'}
                            </span>
                            <span className="text-xs text-blue-500">
                              {formatCents(session.amount_paid)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-blue-400">
                            <Timer size={10} />
                            <span>{session.duration_minutes} min ·</span>
                            <SessionCountdown expectedEndAt={session.expected_end_at} />
                          </div>
                          <form action={handleStopMachine}>
                            <input type="hidden" name="session_id" value={session.id} />
                            <input type="hidden" name="machine_id" value={machine.id} />
                            <button
                              type="submit"
                              className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <PowerOff size={12} />
                              Parar máquina
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Offline warning — bloqueia pagamento */}
                      {machine.status === 'available' && connected && !isOnline && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center space-y-1">
                          <div className="flex items-center justify-center gap-1.5 text-red-500">
                            <WifiOff size={14} />
                            <span className="text-xs font-medium">Dispositivo offline</span>
                          </div>
                          <p className="text-[10px] text-red-400">
                            O relé não está respondendo. Não é possível liberar ou cobrar até que a conexão seja restabelecida.
                          </p>
                        </div>
                      )}

                      {/* Start form — só aparece se online */}
                      {canStart && (
                        <form action={handleStartMachine} className="space-y-2">
                          <input type="hidden" name="machine_id" value={machine.id} />
                          <input
                            name="guest_name"
                            placeholder="Nome (opcional)"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              name="duration_minutes"
                              defaultValue={p?.min_minutes ?? 30}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              {p && Array.from(
                                { length: Math.floor((p.max_minutes - p.min_minutes) / p.step_minutes) + 1 },
                                (_, i) => p.min_minutes + i * p.step_minutes
                              ).map(min => (
                                <option key={min} value={min}>
                                  {min} min — {formatCents(min * p.price_per_minute_cents)}
                                </option>
                              ))}
                              {!p && [15, 30, 45, 60, 90, 120].map(min => (
                                <option key={min} value={min}>{min} min</option>
                              ))}
                            </select>
                            <select
                              name="payment_method"
                              defaultValue="cash"
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              <option value="cash">Dinheiro</option>
                              <option value="pix">PIX</option>
                              <option value="credit">Crédito</option>
                              <option value="debit">Débito</option>
                              <option value="free">Cortesia</option>
                            </select>
                          </div>
                          <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Power size={12} />
                            Liberar máquina
                          </button>
                        </form>
                      )}

                      {/* No connection configured */}
                      {machine.status === 'available' && !connected && (
                        <p className="text-[10px] text-amber-500 text-center">
                          Configure a conexão do dispositivo (Shelly Cloud ou IP local) para liberar remotamente
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── MÁQUINAS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'maquinas' && (
          <div className="space-y-4">
            {/* Create form */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Plus size={14} />
                Nova máquina
              </h3>
              <form action={handleCreateMachine} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input name="name" required placeholder="Nome (ex: Máquina 1)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <select name="type" defaultValue="washer" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="washer">Lavadora</option>
                  <option value="dryer">Secadora</option>
                </select>
                <input name="location" placeholder="Localização (ex: Bloco B, térreo)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Dispositivo smart</label>
                  <DeviceSelect name="device_type" devices={deviceOptions} />
                </div>
                <ConnectionFields />
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
                    Cadastrar
                  </button>
                </div>
              </form>
              <form action={handleTestConnection} className="mt-2 flex items-center gap-2">
                <input name="device_ip" placeholder="IP para testar" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="hidden" name="device_type" value="" />
                <button type="submit" className="px-3 py-2 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-1 whitespace-nowrap">
                  <Wifi size={12} />
                  Testar conexão
                </button>
              </form>
            </div>

            {/* Machine list */}
            {machinesList.map(machine => (
              <details key={machine.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <WashingMachine size={16} className="text-gray-400" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{machine.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{typeLabel[machine.type]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {machine.connection_mode === 'cloud' && machine.cloud_device_id ? (
                      <span className="text-[10px] text-blue-500 font-mono flex items-center gap-1">
                        <Cloud size={10} />
                        {machine.cloud_device_id}
                      </span>
                    ) : machine.device_ip ? (
                      <span className="text-[10px] text-gray-400 font-mono">{machine.device_ip}</span>
                    ) : null}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor[machine.status]}`}>
                      {statusLabel[machine.status]}
                    </span>
                    <Pencil size={12} className="text-gray-300" />
                  </div>
                </summary>
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <form action={handleUpdateMachine} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="hidden" name="id" value={machine.id} />
                    <input name="name" required defaultValue={machine.name} placeholder="Nome" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <select name="type" defaultValue={machine.type} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="washer">Lavadora</option>
                      <option value="dryer">Secadora</option>
                    </select>
                    <input name="location" defaultValue={machine.location ?? ''} placeholder="Localização" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <select name="status" defaultValue={machine.status} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="available">Disponível</option>
                      <option value="maintenance">Manutenção</option>
                      <option value="offline">Offline</option>
                    </select>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Dispositivo smart</label>
                      <DeviceSelect name="device_type" devices={deviceOptions} defaultValue={machine.device_type} />
                    </div>
                    <ConnectionFields
                      defaultMode={machine.connection_mode}
                      defaultIp={machine.device_ip}
                      defaultAuth={machine.device_auth}
                      defaultCloudServer={machine.cloud_server}
                      defaultCloudDeviceId={machine.cloud_device_id}
                      defaultCloudAuthKey={machine.cloud_auth_key}
                    />
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                      <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-1.5">
                        <Pencil size={12} />
                        Salvar
                      </button>
                    </div>
                  </form>
                  <div className="mt-2 flex justify-between items-center">
                    <form action={handleTestMachine}>
                      <input type="hidden" name="id" value={machine.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-1"
                      >
                        <Wifi size={12} />
                        Testar conexão
                      </button>
                    </form>
                    <form action={handleDeleteMachine}>
                      <input type="hidden" name="id" value={machine.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        Remover
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}

        {/* ── PREÇOS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'precos' && (
          <div className="space-y-4">
            {(['washer', 'dryer'] as const).map(machineType => {
              const p = pricingMap.get(machineType)
              return (
                <div key={machineType} className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    {typeLabel[machineType]}
                  </h3>
                  <form action={handleSavePricing} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="hidden" name="pricing_id" value={p?.id ?? ''} />
                    <input type="hidden" name="machine_type" value={machineType} />
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Preço por minuto (R$)</label>
                      <input
                        name="price_per_minute"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        defaultValue={p ? (p.price_per_minute_cents / 100).toFixed(2) : ''}
                        placeholder="0.27"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Tempo mínimo (min)</label>
                      <input
                        name="min_minutes"
                        type="number"
                        min="1"
                        required
                        defaultValue={p?.min_minutes ?? 15}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Tempo máximo (min)</label>
                      <input
                        name="max_minutes"
                        type="number"
                        min="1"
                        required
                        defaultValue={p?.max_minutes ?? 180}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Incremento (min)</label>
                      <input
                        name="step_minutes"
                        type="number"
                        min="1"
                        required
                        defaultValue={p?.step_minutes ?? 15}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      {p && (
                        <p className="text-xs text-gray-400 mb-2">
                          Exemplos: 30 min = {formatCents(30 * p.price_per_minute_cents)} · 60 min = {formatCents(60 * p.price_per_minute_cents)} · 120 min = {formatCents(120 * p.price_per_minute_cents)}
                        </p>
                      )}
                      <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
                        Salvar preço
                      </button>
                    </div>
                  </form>
                </div>
              )
            })}
          </div>
        )}
        {/* ── DISPOSITIVOS TAB ────────────────────────────────────────── */}
        {activeTab === 'dispositivos' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Modelos de dispositivos smart compatíveis com o sistema. Dispositivos globais vêm pré-cadastrados. Você pode adicionar modelos customizados para sua base.
            </p>

            {/* Lista de modelos existentes */}
            {deviceModels.map(d => {
              const diffLabel: Record<string, string> = { easy: 'Fácil', medium: 'Intermediário', advanced: 'Avançado' }
              const diffColor: Record<string, string> = {
                easy: 'bg-green-100 text-green-700',
                medium: 'bg-yellow-100 text-yellow-700',
                advanced: 'bg-red-100 text-red-700',
              }
              return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className={d.difficulty === 'easy' ? 'text-green-500' : 'text-gray-400'} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{d.brand} — {d.model}</p>
                        {d.difficulty === 'easy' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white">RECOMENDADO</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">{d.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${diffColor[d.difficulty] ?? ''}`}>
                      {diffLabel[d.difficulty] ?? d.difficulty}
                    </span>
                    {d.id.startsWith('custom_') && (
                      <form action={handleDeleteDeviceModel}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                          <Trash2 size={10} />
                          Remover
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {d.setup_instructions && (
                  <details className="mt-3">
                    <summary className="text-xs text-brand-500 cursor-pointer flex items-center gap-1 hover:text-brand-700">
                      <Info size={12} />
                      Instruções de instalação
                    </summary>
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                      {d.setup_instructions}
                    </div>
                  </details>
                )}
              </div>
              )
            })}

            {/* Cadastrar modelo customizado */}
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Plus size={14} />
                Cadastrar dispositivo customizado
              </h3>
              <p className="text-[10px] text-gray-400 mb-3">
                Use {'{'}<code className="text-[10px]">ip</code>{'}'} e {'{'}<code className="text-[10px]">seconds</code>{'}'} nos templates de URL. O sistema substitui automaticamente.
              </p>
              <form action={handleCreateDeviceModel} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input name="brand" required placeholder="Marca (ex: Xiaomi)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input name="model" required placeholder="Modelo (ex: Mi Smart Plug)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">URL para LIGAR (com timer)</label>
                  <input name="start_url" required placeholder="http://{ip}/relay/0?turn=on&timer={seconds}" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">URL para DESLIGAR</label>
                  <input name="stop_url" required placeholder="http://{ip}/relay/0?turn=off" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">URL para verificar STATUS</label>
                  <input name="status_url" required placeholder="http://{ip}/status" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Instruções de instalação (opcional)</label>
                  <textarea name="setup_instructions" rows={3} placeholder="Passo a passo para configurar este dispositivo..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
                  Cadastrar modelo
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
