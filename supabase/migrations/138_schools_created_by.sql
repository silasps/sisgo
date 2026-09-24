-- 138: rastreia quem criou cada escola (log/auditoria futura) e dá acesso
-- de visualizar/editar ao criador — sem torná-lo "líder" formal (não entra
-- em school_leaders, não aparece em "Liderança da Escola", não conta pro
-- alerta de "sem líder"). Ver src/lib/auth/unit-access.ts (getMySchools).

alter table schools add column if not exists created_by uuid references auth.users(id) on delete set null;
