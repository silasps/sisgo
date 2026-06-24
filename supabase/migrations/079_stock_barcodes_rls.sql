-- 079: habilitar RLS na tabela kitchen_stock_barcodes (estava exposta sem proteção)

alter table public.kitchen_stock_barcodes enable row level security;

create policy "stock_barcodes - org select" on public.kitchen_stock_barcodes
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "stock_barcodes - kitchen manage" on public.kitchen_stock_barcodes
  for all using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base','dh','secretaria','cozinha')
    )
  )
  with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base','dh','secretaria','cozinha')
    )
  );
