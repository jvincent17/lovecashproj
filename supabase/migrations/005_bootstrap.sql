-- =============================================================
-- Duit Kara - migrasi 005: muat semua data awal dalam SATU permintaan
-- (mempercepat buka aplikasi & login). Data yang ada TIDAK diubah.
-- =============================================================

create or replace function public.app_bootstrap(sel_period uuid default null, today date default current_date)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cf  uuid;
  p   periods;
begin
  cf := ensure_profile(); -- sekaligus memastikan profil & cashflow ada

  if sel_period is not null then
    select * into p from periods where id = sel_period and cashflow_id = cf;
  end if;
  if p.id is null then
    select * into p from periods where cashflow_id = cf and today between start_date and end_date limit 1;
  end if;
  if p.id is null then
    select * into p from periods where cashflow_id = cf order by start_date desc limit 1;
  end if;

  return jsonb_build_object(
    'cf', cf,
    'profile', (select to_jsonb(x) from profiles x where x.id = uid),
    'cashflow', (select to_jsonb(c) from cashflows c where c.id = cf),
    'my_cashflows', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', m.role) order by m.joined_at)
      from cashflow_members m join cashflows c on c.id = m.cashflow_id where m.user_id = uid), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(m) || jsonb_build_object('profile', (
        select jsonb_build_object('id', pr.id, 'username', pr.username, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)
        from profiles pr where pr.id = m.user_id)) order by m.joined_at)
      from cashflow_members m where m.cashflow_id = cf), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from categories x where x.cashflow_id = cf), '[]'::jsonb),
    'periods', coalesce((select jsonb_agg(to_jsonb(x) order by x.start_date desc) from periods x where x.cashflow_id = cf), '[]'::jsonb),
    'debts', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from debts x where x.cashflow_id = cf), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc) from debt_payments x where x.cashflow_id = cf), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from wallets x where x.cashflow_id = cf), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('wallet_id', b.wallet_id, 'balance', b.balance)) from wallet_balances(cf) b), '[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc, t.created_at desc) from (
      select * from wallet_transfers x where x.cashflow_id = cf order by x.date desc, x.created_at desc limit 200) t), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from quick_templates x where x.cashflow_id = cf), '[]'::jsonb),
    'period_id', p.id,
    'incomes', coalesce((select jsonb_agg(to_jsonb(x) order by x.date, x.created_at) from incomes x where x.period_id = p.id), '[]'::jsonb),
    'bills', coalesce((select jsonb_agg(to_jsonb(x) order by x.due_date, x.created_at) from bills x
      where x.cashflow_id = cf and x.due_date between p.start_date and p.end_date + 62), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(to_jsonb(x)) from budget_overrides x where x.period_id = p.id), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc, x.created_at desc) from expenses x
      where x.cashflow_id = cf and x.date between p.start_date and p.end_date), '[]'::jsonb)
  );
end $$;

revoke all on function public.app_bootstrap(uuid, date) from public, anon;
grant execute on function public.app_bootstrap(uuid, date) to authenticated;
