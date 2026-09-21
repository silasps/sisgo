-- ============================================================
-- SISGO — Migration 126: justificativa de resolução em service_requests
-- ============================================================
--
-- Hospitalidade, ao responder um pedido de hospedagem sem ter quarto
-- disponível, agora precisa registrar o motivo — esse texto some do
-- "achismo" (rejeitado sem explicação) e passa a aparecer de volta no
-- fluxo de aprovação do obreiro/aluno, junto com o quarto quando há
-- alocação. Genérico o bastante pra outros departamentos reaproveitarem
-- no futuro (não é campo exclusivo de hospedagem).

alter table service_requests
  add column if not exists resolution_notes text;
