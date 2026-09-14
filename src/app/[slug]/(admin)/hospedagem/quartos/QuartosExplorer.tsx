'use client'

import { useState } from 'react'
import { BlockForm } from './BlockForm'
import { FloorForm } from './FloorForm'
import { RoomForm } from './RoomForm'
import { BedForm } from './BedForm'
import { AllocationManager } from './[roomId]/AllocationManager'
import { CascadeDeleteDialog } from '@/components/ui/CascadeDeleteDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StopClickPropagation } from '@/components/ui/StopClickPropagation'
import { Building2, ChevronRight, Pencil, Trash2, X } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  quarto: 'Quarto',
  suite: 'Suíte',
  dormitorio: 'Dormitório',
  casal: 'Casal',
}

const GENDER_LABELS: Record<string, { label: string; cls: string }> = {
  masculino: { label: 'Masc.', cls: 'bg-blue-100 text-blue-700' },
  feminino:  { label: 'Fem.',  cls: 'bg-pink-100 text-pink-700' },
  misto:     { label: 'Misto', cls: 'bg-purple-100 text-purple-700' },
}

const DESTINATION_LABELS: Record<string, string> = {
  visita: 'Visitantes', aluno: 'Alunos', obreiro: 'Obreiros',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ativo:      { label: 'Ativo',      cls: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', cls: 'bg-yellow-100 text-yellow-700' },
  inativo:    { label: 'Inativo',    cls: 'bg-gray-100 text-gray-500' },
}

const BED_STATUS_DOT: Record<string, string> = {
  disponivel: 'bg-green-400',
  ocupada:    'bg-blue-400',
  manutencao: 'bg-yellow-400',
  reservada:  'bg-purple-400',
}

const BED_STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  ocupada:    'Ocupada',
  manutencao: 'Manutenção',
  reservada:  'Reservada',
}

function bedsLabel(n: number) {
  return `${n} cama${n !== 1 ? 's' : ''} cadastrada${n !== 1 ? 's' : ''}`
}

type Block = { id: string; name: string; display_order: number }
type Floor = { id: string; block_id: string; name: string; destination: string | null; gender_constraint: string | null; display_order: number }
type Room = {
  id: string; name: string; floor_id: string; type: string
  gender_constraint: string | null; destination: string; allocation_mode: string; capacity: number; status: string
  notes: string | null; display_order: number
}
type Bed = { id: string; label: string; status: string; type: string; notes: string | null }
type FloorOption = { id: string; name: string; blockName: string; destination: string | null; genderConstraint: string | null }
type Allocation = {
  id: string; guest_name: string; guest_type: string; bed_id: string | null; bed_label: string | null
  check_in: string; check_out: string; actual_check_in: string | null; actual_check_out: string | null
  status: string; notes: string | null
}

type Props = {
  blocks: Block[]
  floors: Floor[]
  rooms: Room[]
  bedsByRoom: Record<string, Bed[]>
  allocationsByRoom: Record<string, Allocation[]>
  floorOptions: FloorOption[]
  createBlockAction: (formData: FormData) => Promise<void>
  editBlockAction: (formData: FormData) => Promise<void>
  deleteBlockAction: (id: string) => Promise<void>
  createFloorAction: (formData: FormData) => Promise<void>
  editFloorAction: (formData: FormData) => Promise<void>
  deleteFloorAction: (id: string) => Promise<void>
  createRoomAction: (formData: FormData) => Promise<void>
  editRoomAction: (formData: FormData) => Promise<void>
  deleteRoomAction: (id: string) => Promise<void>
  createBedAction: (formData: FormData) => Promise<void>
  editBedAction: (formData: FormData) => Promise<void>
  deleteBedAction: (id: string, roomId: string) => Promise<void>
  createAllocationAction: (roomId: string, formData: FormData) => Promise<void>
  checkinAction: (formData: FormData) => Promise<void>
  checkoutAction: (formData: FormData) => Promise<void>
  cancelAllocationAction: (formData: FormData) => Promise<void>
}

export function QuartosExplorer({
  blocks, floors, rooms, bedsByRoom, allocationsByRoom, floorOptions,
  createBlockAction, editBlockAction, deleteBlockAction,
  createFloorAction, editFloorAction, deleteFloorAction,
  createRoomAction, editRoomAction, deleteRoomAction,
  createBedAction, editBedAction, deleteBedAction,
  createAllocationAction, checkinAction, checkoutAction, cancelAllocationAction,
}: Props) {
  const [blockId, setBlockId] = useState<string | null>(null)
  const [floorId, setFloorId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)

  const block = blockId ? blocks.find(b => b.id === blockId) ?? null : null
  const floor = floorId ? floors.find(f => f.id === floorId) ?? null : null
  const room  = roomId  ? rooms.find(r => r.id === roomId) ?? null   : null

  function collapseAll() {
    setBlockId(null); setFloorId(null); setRoomId(null)
  }

  return (
    <div className="space-y-3">
      {/* sticky — com Camas/Ocupantes a área fica alta, então o caminho de
          volta (breadcrumb + colapsar tudo) precisa ficar visível rolando */}
      <div className="sticky top-16 z-20 bg-gray-50/95 backdrop-blur-sm py-2 -mx-1 px-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs flex-wrap min-w-0">
          {block && (
            <>
              <button type="button" onClick={collapseAll} className="text-gray-500 hover:text-gray-800 font-medium">
                Blocos
              </button>
              <ChevronRight size={12} className="text-gray-300 shrink-0" />
              <button
                type="button"
                onClick={() => { setFloorId(null); setRoomId(null) }}
                className={`hover:text-gray-800 ${!floor ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {block.name}
              </button>
              {floor && (
                <>
                  <ChevronRight size={12} className="text-gray-300 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setRoomId(null)}
                    className={`hover:text-gray-800 ${!room ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                  >
                    {floor.name}
                  </button>
                </>
              )}
              {room && (
                <>
                  <ChevronRight size={12} className="text-gray-300 shrink-0" />
                  <span className="font-semibold text-gray-900">{room.name}</span>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {block && (
            <button type="button" onClick={collapseAll} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 text-xs">
              <X size={12} /> Colapsar tudo
            </button>
          )}
          {/* O botão de criar troca de rótulo/ação conforme o nível atual —
              bloco no topo, andar dentro de um bloco, quarto dentro de um
              andar, cama dentro de um quarto. */}
          {!block && (
            <BlockForm createAction={createBlockAction} editAction={editBlockAction} />
          )}
          {block && !floor && (
            <FloorForm
              createAction={createFloorAction}
              editAction={editFloorAction}
              blockId={block.id}
              trigger={
                <button type="button" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                  + Andar
                </button>
              }
            />
          )}
          {block && floor && !room && (
            <RoomForm
              createAction={createRoomAction}
              editAction={editRoomAction}
              floors={floorOptions}
              defaultFloorId={floor.id}
            />
          )}
          {block && floor && room && (
            <BedForm createAction={createBedAction} roomId={room.id} />
          )}
        </div>
      </div>

      {!block && (
        <BlocksLevel
          blocks={blocks} floors={floors} rooms={rooms} bedsByRoom={bedsByRoom}
          onOpen={setBlockId}
          createBlockAction={createBlockAction} editBlockAction={editBlockAction} deleteBlockAction={deleteBlockAction}
        />
      )}

      {block && !floor && (
        <FloorsLevel
          block={block} floors={floors} rooms={rooms} bedsByRoom={bedsByRoom}
          onOpen={setFloorId}
          createFloorAction={createFloorAction} editFloorAction={editFloorAction} deleteFloorAction={deleteFloorAction}
        />
      )}

      {block && floor && !room && (
        <RoomsLevel
          floor={floor} rooms={rooms} bedsByRoom={bedsByRoom} floorOptions={floorOptions}
          onOpen={setRoomId}
          createRoomAction={createRoomAction} editRoomAction={editRoomAction} deleteRoomAction={deleteRoomAction}
        />
      )}

      {block && floor && room && (
        <RoomLevel
          room={room} beds={bedsByRoom[room.id] ?? []} allocations={allocationsByRoom[room.id] ?? []} floorOptions={floorOptions}
          createRoomAction={createRoomAction} editRoomAction={editRoomAction} deleteRoomAction={deleteRoomAction}
          createBedAction={createBedAction} editBedAction={editBedAction} deleteBedAction={deleteBedAction}
          createAllocationAction={createAllocationAction} checkinAction={checkinAction}
          checkoutAction={checkoutAction} cancelAllocationAction={cancelAllocationAction}
        />
      )}
    </div>
  )
}

// ── Nível 1: blocos ──────────────────────────────────────────────────────────

function BlocksLevel({ blocks, floors, rooms, bedsByRoom, onOpen, createBlockAction, editBlockAction, deleteBlockAction }: {
  blocks: Block[]; floors: Floor[]; rooms: Room[]; bedsByRoom: Record<string, Bed[]>
  onOpen: (id: string) => void
  createBlockAction: Props['createBlockAction']; editBlockAction: Props['editBlockAction']; deleteBlockAction: Props['deleteBlockAction']
}) {
  return (
    <div className="space-y-2">
      {blocks.map(b => {
        const bFloors = floors.filter(f => f.block_id === b.id)
        const bFloorIds = new Set(bFloors.map(f => f.id))
        const bRooms = rooms.filter(r => bFloorIds.has(r.floor_id))
        const bBeds = bRooms.reduce((sum, r) => sum + (bedsByRoom[r.id]?.length ?? 0), 0)
        const details = [
          ...(bFloors.length > 0 ? [`${bFloors.length} andar${bFloors.length !== 1 ? 'es' : ''}`] : []),
          ...(bRooms.length > 0 ? [`${bRooms.length} quarto${bRooms.length !== 1 ? 's' : ''}`] : []),
          ...(bBeds > 0 ? [bedsLabel(bBeds)] : []),
        ]
        return (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(b.id)}
            onKeyDown={e => { if (e.key === 'Enter') onOpen(b.id) }}
            className="group relative cursor-pointer bg-white rounded-xl border border-gray-200 p-4 space-y-2 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="absolute top-3 right-3 z-10">
              <StopClickPropagation>
                <BlockForm
                  createAction={createBlockAction}
                  editAction={editBlockAction}
                  block={b}
                  trigger={
                    <span className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:scale-110 transition-transform inline-block cursor-pointer" title="Editar bloco">
                      <Pencil size={14} />
                    </span>
                  }
                />
                <CascadeDeleteDialog itemLabel="bloco" itemName={b.name} details={details} onConfirm={deleteBlockAction.bind(null, b.id)}>
                  <span className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:scale-110 transition-transform inline-block cursor-pointer" title="Remover bloco">
                    <Trash2 size={14} />
                  </span>
                </CascadeDeleteDialog>
              </StopClickPropagation>
            </div>

            <div className="flex items-center gap-2 min-w-0 pr-14">
              <Building2 size={16} className="text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">{b.name}</span>
            </div>
            <p className="text-xs text-gray-400">
              {bFloors.length} andar{bFloors.length !== 1 ? 'es' : ''} · {bRooms.length} quarto{bRooms.length !== 1 ? 's' : ''} · {bBeds} cama{bBeds !== 1 ? 's' : ''}
            </p>
            <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Ver andares →
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Nível 2: andares de um bloco ─────────────────────────────────────────────

function FloorsLevel({ block, floors, rooms, bedsByRoom, onOpen, createFloorAction, editFloorAction, deleteFloorAction }: {
  block: Block; floors: Floor[]; rooms: Room[]; bedsByRoom: Record<string, Bed[]>
  onOpen: (id: string) => void
  createFloorAction: Props['createFloorAction']; editFloorAction: Props['editFloorAction']; deleteFloorAction: Props['deleteFloorAction']
}) {
  const blockFloors = floors.filter(f => f.block_id === block.id)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        {blockFloors.length} andar{blockFloors.length !== 1 ? 'es' : ''} neste bloco
      </p>

      {blockFloors.length === 0 ? (
        <p className="text-xs text-gray-400 bg-white rounded-xl border border-gray-200 px-4 py-4">
          Nenhum andar neste bloco ainda.
        </p>
      ) : (
        blockFloors.map(f => {
          const fRooms = rooms.filter(r => r.floor_id === f.id)
          const fBeds = fRooms.reduce((sum, r) => sum + (bedsByRoom[r.id]?.length ?? 0), 0)
          const details = [
            ...(fRooms.length > 0 ? [`${fRooms.length} quarto${fRooms.length !== 1 ? 's' : ''}`] : []),
            ...(fBeds > 0 ? [bedsLabel(fBeds)] : []),
          ]
          return (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(f.id)}
              onKeyDown={e => { if (e.key === 'Enter') onOpen(f.id) }}
              className="group relative cursor-pointer bg-white rounded-xl border border-gray-200 p-4 space-y-2 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="absolute top-3 right-3 z-10">
                <StopClickPropagation>
                  <FloorForm
                    createAction={createFloorAction}
                    editAction={editFloorAction}
                    blockId={block.id}
                    floor={f}
                    trigger={
                      <span className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:scale-110 transition-transform inline-block cursor-pointer" title="Editar andar">
                        <Pencil size={14} />
                      </span>
                    }
                  />
                  <CascadeDeleteDialog itemLabel="andar" itemName={f.name} details={details} onConfirm={deleteFloorAction.bind(null, f.id)}>
                    <span className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:scale-110 transition-transform inline-block cursor-pointer" title="Remover andar">
                      <Trash2 size={14} />
                    </span>
                  </CascadeDeleteDialog>
                </StopClickPropagation>
              </div>

              <div className="min-w-0 pr-14">
                <p className="font-medium text-gray-900 truncate group-hover:text-brand-600 transition-colors">{f.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {f.destination && (
                    <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {DESTINATION_LABELS[f.destination]}
                    </span>
                  )}
                  {f.gender_constraint && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${GENDER_LABELS[f.gender_constraint].cls}`}>
                      {GENDER_LABELS[f.gender_constraint].label}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {fRooms.length} quarto{fRooms.length !== 1 ? 's' : ''} · {fBeds} cama{fBeds !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Ver quartos →
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Nível 3: quartos de um andar ─────────────────────────────────────────────

function RoomsLevel({ floor, rooms, bedsByRoom, floorOptions, onOpen, createRoomAction, editRoomAction, deleteRoomAction }: {
  floor: Floor; rooms: Room[]; bedsByRoom: Record<string, Bed[]>; floorOptions: FloorOption[]
  onOpen: (id: string) => void
  createRoomAction: Props['createRoomAction']; editRoomAction: Props['editRoomAction']; deleteRoomAction: Props['deleteRoomAction']
}) {
  const floorRooms = rooms.filter(r => r.floor_id === floor.id)

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        {floorRooms.length} quarto{floorRooms.length !== 1 ? 's' : ''} neste andar
      </p>

      {floorRooms.length === 0 ? (
        <p className="text-xs text-gray-400 bg-white rounded-xl border border-gray-200 px-4 py-4">
          Nenhum quarto neste andar ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {floorRooms.map(r => (
            <RoomCard
              key={r.id} room={r} beds={bedsByRoom[r.id] ?? []} floorOptions={floorOptions}
              onOpen={() => onOpen(r.id)}
              createRoomAction={createRoomAction} editRoomAction={editRoomAction} deleteRoomAction={deleteRoomAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RoomCard({ room, beds, floorOptions, onOpen, createRoomAction, editRoomAction, deleteRoomAction }: {
  room: Room; beds: Bed[]; floorOptions: FloorOption[]
  onOpen: () => void
  createRoomAction: Props['createRoomAction']; editRoomAction: Props['editRoomAction']; deleteRoomAction: Props['deleteRoomAction']
}) {
  const st       = STATUS_LABELS[room.status] ?? STATUS_LABELS.ativo
  const gender   = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null
  const occupied = beds.filter(b => b.status === 'ocupada').length
  const pct      = beds.length > 0 ? Math.round((occupied / beds.length) * 100) : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className="group relative cursor-pointer bg-white rounded-xl border border-gray-200 p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <StopClickPropagation>
          <RoomForm
            createAction={createRoomAction}
            editAction={editRoomAction}
            floors={floorOptions}
            room={{
              id: room.id,
              name: room.name,
              floorId: room.floor_id ?? '',
              type: room.type,
              gender_constraint: room.gender_constraint,
              destination: room.destination,
              allocation_mode: room.allocation_mode,
              status: room.status,
              notes: room.notes,
            }}
            trigger={
              <span className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:scale-110 transition-transform inline-block cursor-pointer" title="Editar quarto">
                <Pencil size={14} />
              </span>
            }
          />
          <CascadeDeleteDialog
            itemLabel="quarto"
            itemName={room.name}
            details={beds.length > 0 ? [bedsLabel(beds.length)] : []}
            onConfirm={deleteRoomAction.bind(null, room.id)}
          >
            <span className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:scale-110 transition-transform inline-block cursor-pointer" title="Remover quarto">
              <Trash2 size={14} />
            </span>
          </CascadeDeleteDialog>
        </StopClickPropagation>
      </div>

      <div className="min-w-0 pr-14">
        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
          {room.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            {TYPE_LABELS[room.type] ?? room.type}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>
            {st.label}
          </span>
          {gender && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gender.cls}`}>
              {gender.label}
            </span>
          )}
        </div>
      </div>

      {beds.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{occupied}/{beds.length} camas ocupadas</span>
            <span className="font-medium">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Nenhuma cama cadastrada</p>
      )}

      <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Ver camas →
      </p>
    </div>
  )
}

// ── Nível 4: camas de um quarto ──────────────────────────────────────────────

function RoomLevel({
  room, beds, allocations, floorOptions,
  createRoomAction, editRoomAction, deleteRoomAction,
  createBedAction, editBedAction, deleteBedAction,
  createAllocationAction, checkinAction, checkoutAction, cancelAllocationAction,
}: {
  room: Room; beds: Bed[]; allocations: Allocation[]; floorOptions: FloorOption[]
  createRoomAction: Props['createRoomAction']; editRoomAction: Props['editRoomAction']; deleteRoomAction: Props['deleteRoomAction']
  createBedAction: Props['createBedAction']; editBedAction: Props['editBedAction']; deleteBedAction: Props['deleteBedAction']
  createAllocationAction: Props['createAllocationAction']; checkinAction: Props['checkinAction']
  checkoutAction: Props['checkoutAction']; cancelAllocationAction: Props['cancelAllocationAction']
}) {
  const st          = STATUS_LABELS[room.status] ?? STATUS_LABELS.ativo
  const gender      = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null
  const occupied    = beds.filter(b => b.status === 'ocupada').length
  const availableBeds = beds.filter(b => b.status === 'disponivel').map(b => ({ id: b.id, label: b.label }))

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <p className="font-semibold text-gray-900">{room.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {TYPE_LABELS[room.type] ?? room.type}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
              {gender && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gender.cls}`}>{gender.label}</span>
              )}
              <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {DESTINATION_LABELS[room.destination] ?? room.destination}
              </span>
            </div>
            {room.notes && <p className="text-xs text-gray-500">{room.notes}</p>}
          </div>
          <StopClickPropagation>
            <RoomForm
              createAction={createRoomAction}
              editAction={editRoomAction}
              floors={floorOptions}
              room={{
                id: room.id,
                name: room.name,
                floorId: room.floor_id ?? '',
                type: room.type,
                gender_constraint: room.gender_constraint,
                destination: room.destination,
                allocation_mode: room.allocation_mode,
                status: room.status,
                notes: room.notes,
              }}
              trigger={
                <span className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:scale-110 transition-transform inline-block cursor-pointer" title="Editar quarto">
                  <Pencil size={16} />
                </span>
              }
            />
            <CascadeDeleteDialog
              itemLabel="quarto"
              itemName={room.name}
              details={beds.length > 0 ? [bedsLabel(beds.length)] : []}
              onConfirm={deleteRoomAction.bind(null, room.id)}
            >
              <span className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:scale-110 transition-transform inline-block cursor-pointer" title="Remover quarto">
                <Trash2 size={16} />
              </span>
            </CascadeDeleteDialog>
          </StopClickPropagation>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Camas {beds.length > 0 && `(${occupied}/${beds.length} ocupadas)`}
        </h3>

        {room.allocation_mode !== 'cama' ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Este quarto é alocado inteiro (sem cama a cama).
          </p>
        ) : beds.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Nenhuma cama cadastrada neste quarto ainda. Use o botão &ldquo;+ Cama&rdquo; no topo.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {beds.map(bed => (
              <div key={bed.id} className="relative text-left p-3 rounded-lg border-2 border-gray-200 bg-white">
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                  <BedForm
                    createAction={createBedAction}
                    editAction={editBedAction}
                    roomId={room.id}
                    bed={bed}
                    trigger={
                      <span className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:scale-110 transition-transform inline-block cursor-pointer" title="Editar cama">
                        <Pencil size={12} />
                      </span>
                    }
                  />
                  <ConfirmDialog
                    title="Remover cama"
                    message={`Remover a cama "${bed.label}"? Esta ação não pode ser desfeita.`}
                    confirmLabel="Remover"
                    onConfirm={() => deleteBedAction(bed.id, room.id)}
                  >
                    <span className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:scale-110 transition-transform inline-block cursor-pointer" title="Remover cama">
                      <Trash2 size={12} />
                    </span>
                  </ConfirmDialog>
                </div>
                <div className="flex items-center gap-1.5 mb-1 pr-10">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BED_STATUS_DOT[bed.status] ?? 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-900 truncate">{bed.label}</span>
                </div>
                <p className="text-[10px] text-gray-400">{BED_STATUS_LABEL[bed.status] ?? bed.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <AllocationManager
          allocations={allocations}
          beds={availableBeds}
          createAction={formData => createAllocationAction(room.id, formData)}
          checkinAction={checkinAction}
          checkoutAction={checkoutAction}
          cancelAction={cancelAllocationAction}
        />
      </div>
    </div>
  )
}
