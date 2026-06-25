-- 083: permitir pré-inscrição de aluno sem escola definida (sem preferência)
-- school_id passa a ser nullable — quando null, só DH/management vê e encaminha

ALTER TABLE public.school_interest_forms ALTER COLUMN school_id DROP NOT NULL;
