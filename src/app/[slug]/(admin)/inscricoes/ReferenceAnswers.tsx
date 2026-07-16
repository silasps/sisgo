export const RECOMENDAM: Record<string, string> = {
  sim: 'Recomendo plenamente',
  sim_ressalvas: 'Recomendo com ressalvas',
  nao: 'Não recomendo',
}
export const RECOMENDAM_COR: Record<string, string> = {
  sim: 'bg-green-100 text-green-700',
  sim_ressalvas: 'bg-yellow-100 text-yellow-700',
  nao: 'bg-red-100 text-red-700',
}
export const APOIA: Record<string, string> = {
  sim: 'Apoia e autoriza',
  nao: 'Não apoia',
}
export const APOIA_COR: Record<string, string> = {
  sim: 'bg-green-100 text-green-700',
  nao: 'bg-red-100 text-red-700',
}
export const ESCALA: Record<string, string> = {
  ruim: 'Ruim',
  regular: 'Regular',
  bom: 'Bom',
  excelente: 'Excelente',
}

export function dificuldadesValue(data: Record<string, string>) {
  if (data.dificuldades === 'sim') return data.dificuldades_detalhe || 'Sim'
  if (data.dificuldades === 'nao') return 'Não'
  return data.dificuldades
}

function condutaMenoresValue(data: Record<string, string>) {
  if (data.conduta_menores === 'tem_preocupacao') return data.conduta_menores_detalhe || 'Preocupação relatada'
  if (data.conduta_menores === 'sem_preocupacao') return 'Sem preocupação'
  return undefined
}

function FieldItem({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

export function ReferenceAnswers({ tipo, data, isStaff }: {
  tipo: 'pastor' | 'amigo'; data: Record<string, string>; isStaff?: boolean
}) {
  if (tipo === 'pastor') {
    return (
      <>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.recomenda && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${RECOMENDAM_COR[data.recomenda] ?? 'bg-gray-100 text-gray-600'}`}>
              {RECOMENDAM[data.recomenda] ?? data.recomenda}
            </span>
          )}
          {data.apoia && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${APOIA_COR[data.apoia] ?? 'bg-gray-100 text-gray-600'}`}>
              {APOIA[data.apoia] ?? data.apoia}
            </span>
          )}
        </div>
        <FieldItem label="Nome" value={data.pastor_nome} />
        <FieldItem label="Cargo / Igreja" value={[data.pastor_cargo, data.pastor_igreja, data.pastor_cidade].filter(Boolean).join(' · ')} />
        <FieldItem label="Tempo que conhece o(a) candidato(a)" value={data.tempo_conhece} />
        <FieldItem label="E-mail" value={data.pastor_email} />
        <FieldItem label="Telefone" value={data.pastor_telefone} />
        <FieldItem label="Caráter e maturidade espiritual" value={ESCALA[data.carater] ?? data.carater} />
        <FieldItem label="Responsabilidade e comprometimento" value={ESCALA[data.responsabilidade] ?? data.responsabilidade} />
        <FieldItem label="Relacionamento com autoridade" value={ESCALA[data.autoridade] ?? data.autoridade} />
        <FieldItem label="Dificuldades conhecidas" value={dificuldadesValue(data)} />
        {isStaff && <FieldItem label="Conduta com menores" value={condutaMenoresValue(data)} />}
        <FieldItem label="Ressalvas / Observações" value={data.observacoes} />
      </>
    )
  }
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {data.recomenda && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${RECOMENDAM_COR[data.recomenda] ?? 'bg-gray-100 text-gray-600'}`}>
            {RECOMENDAM[data.recomenda] ?? data.recomenda}
          </span>
        )}
      </div>
      <FieldItem label="Nome" value={data.ref_nome} />
      <FieldItem label="Como se conheceram" value={data.como_conheceu} />
      <FieldItem label="Tempo de amizade" value={data.tempo_conhece} />
      <FieldItem label="É cristã?" value={data.crista === 'sim' ? 'Sim' : data.crista === 'nao' ? 'Não' : data.crista} />
      <FieldItem label="E-mail" value={data.ref_email} />
      <FieldItem label="Telefone" value={data.ref_telefone} />
      <FieldItem label="Caráter e personalidade" value={data.carater} />
      <FieldItem label="Pontos fortes" value={data.pontos_fortes} />
      <FieldItem label="Áreas de crescimento" value={data.areas_crescimento} />
      <FieldItem label="Sob pressão / conflito" value={data.sob_pressao} />
      <FieldItem label="Relacionamentos" value={data.relacionamentos} />
      {isStaff && <FieldItem label="Conduta com menores" value={condutaMenoresValue(data)} />}
      <FieldItem label="Observações" value={data.observacoes} />
    </>
  )
}
