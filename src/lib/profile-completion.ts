// Quantas vezes a pessoa pode adiar o cadastro (aviso "Cadastro incompleto"
// no shell, botão "Depois"/X) antes de virar bloqueante — sem forma de
// adiar/sair, só resta completar o cadastro. Usado tanto pelo aviso
// (CadastroIncompletoAlert) quanto pelos próprios formulários (obreiro/aluno)
// pra decidir se ainda mostram um jeito de sair sem terminar.
export const PROFILE_COMPLETION_BLOCK_AFTER = 5
