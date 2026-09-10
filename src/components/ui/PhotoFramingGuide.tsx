// Modelo visual de enquadramento pra foto 3x4 — mostrado ANTES da pessoa
// anexar, pra ela saber como tirar a própria foto. A imagem muda conforme o
// sexo informado antes na seção de dados pessoais (campo `sexo`, 'M'/'F');
// sem resposta ainda, cai no masculino por padrão (arbitrário — não há como
// adivinhar).
export function PhotoFramingGuide({ caption, sexo }: { caption: string; sexo?: string }) {
  const src = sexo === 'F' ? '/images/photo-model-female.jpg' : '/images/photo-model-male.jpg'
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- asset estático em public/, sem necessidade do otimizador */}
      <img src={src} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0" />
      <p className="text-[11px] text-gray-400 leading-snug">{caption}</p>
    </div>
  )
}
