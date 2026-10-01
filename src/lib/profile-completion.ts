// Quantas vezes a pessoa pode adiar o cadastro (aviso "Cadastro incompleto"
// no shell, botão "Depois"/X) antes de virar bloqueante — sem forma de
// adiar/sair, só resta completar o cadastro. Usado tanto pelo aviso
// (CadastroIncompletoAlert) quanto pelos próprios formulários (obreiro/aluno)
// pra decidir se ainda mostram um jeito de sair sem terminar.
export const PROFILE_COMPLETION_BLOCK_AFTER = 5

// Perfis criados com o mínimo (ex.: "Criar obreiro" em Obreiros só pede nome
// + e-mail, import em massa idem) ficam sem telefone nenhum cadastrado — os
// botões de WhatsApp espalhados pelo sistema ficam inúteis pra essa pessoa.
// Usado tanto pelo gate em (admin)/layout.tsx (redireciona pro
// /primeiro-acesso) quanto pela própria tela de /primeiro-acesso (decide se
// mostra a etapa de completar telefone).
export async function isMissingPhone(
  db: { from: (table: string) => ReturnType<import('@supabase/supabase-js').SupabaseClient['from']> },
  userId: string,
): Promise<boolean> {
  const { data: profiles } = await db.from('staff_profiles').select('person_id').eq('user_id', userId)
  const personId = (profiles as Array<{ person_id: string }> | null)?.[0]?.person_id
  if (!personId) return false

  const { count } = await db.from('person_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', personId)
    .in('type', ['whatsapp', 'phone'])
  return (count ?? 0) === 0
}
