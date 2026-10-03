-- Cargo+420 — schema, security, ordering RPCs, push trigger
create extension if not exists pg_net with schema extensions;

-- ---------- helpers ----------
create or replace function public.norm_phone(p text) returns text
language sql immutable set search_path = public as $fn$
  select case when length(d) = 10
    then '(' || substr(d,1,3) || ') ' || substr(d,4,3) || '-' || substr(d,7,4) end
  from (select right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10) as d) x
$fn$;

-- ---------- tables ----------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  hours text not null default '11am – 11pm daily',
  redeliver text not null default '$10–$20 depending on area',
  base_min numeric(10,2) not null default 40,
  open boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.zones (
  id serial primary key,
  min_order numeric(10,2) not null,
  fee numeric(10,2) not null default 0,
  cities text[] not null,
  sort int not null default 0
);

create table public.tiers (
  id text primary key,
  name text not null,
  price numeric(10,2) not null,
  pct_off int not null check (pct_off between 0 and 90),
  waive_fee boolean not null default false,
  perks text[] not null default '{}',
  sort int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cat text not null check (cat in ('flower','edibles','cbd','concentrates','mushrooms','vapes','enhance','smoke')),
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  tags text[] not null default '{}',
  thc text, size text, strain text, description text,
  featured boolean not null default false,
  active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  address text,
  city text,
  id_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence public.order_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('C420-' || nextval('public.order_seq')),
  created_at timestamptz not null default now(),
  customer_id uuid references public.customers(id) on delete set null,
  cust_name text not null,
  cust_phone text not null,
  address text not null,
  city text not null,
  notes text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  tier text,
  status text not null default 'new' check (status in ('new','confirmed','out','delivered','cancelled')),
  driver_id uuid references public.drivers(id) on delete set null,
  collected numeric(10,2),
  delivered_at timestamptz,
  cash_in boolean not null default false,
  cash_in_at timestamptz
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_phone_idx on public.orders (cust_phone, created_at desc);
create index orders_customer_idx on public.orders (customer_id);
create index orders_driver_idx on public.orders (driver_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null,
  tier text not null references public.tiers(id),
  status text not null default 'pending' check (status in ('pending','active','ended','declined')),
  applied_at timestamptz not null default now(),
  next_due date
);
create unique index members_one_open on public.members (phone) where status in ('pending','active');
create index members_tier_idx on public.members (tier);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  time_label text,
  title text not null,
  place text,
  description text,
  members_only boolean not null default false,
  rsvp_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
create index push_user_idx on public.push_subscriptions (user_id);

-- server-only secrets (no RLS policies => only service role can read)
create table public.private_config (
  id int primary key default 1 check (id = 1),
  vapid_public text, vapid_private text, vapid_subject text,
  hook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  fn_url text
);

-- ---------- auth helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.admins where user_id = auth.uid())
$fn$;

-- The very first account created becomes the owner. Later sign-ups get no access.
create or replace function public.first_user_admin() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from public.admins) then
    insert into public.admins (user_id) values (new.id);
  end if;
  return new;
end $fn$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.first_user_admin();

-- ---------- row level security ----------
alter table public.admins enable row level security;
alter table public.store_settings enable row level security;
alter table public.zones enable row level security;
alter table public.tiers enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.drivers enable row level security;
alter table public.orders enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.private_config enable row level security;

create policy "admins read self" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create policy "public read" on public.store_settings for select to anon, authenticated using (true);
create policy "admin write" on public.store_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read" on public.zones for select to anon, authenticated using (true);
create policy "admin insert" on public.zones for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.zones for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.zones for delete to authenticated using ((select public.is_admin()));

create policy "public read" on public.tiers for select to anon, authenticated using (true);
create policy "admin update" on public.tiers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read active" on public.products for select to anon, authenticated using (active or (select public.is_admin()));
create policy "admin insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.products for delete to authenticated using ((select public.is_admin()));

create policy "public read" on public.events for select to anon, authenticated using (true);
create policy "admin insert" on public.events for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.events for delete to authenticated using ((select public.is_admin()));

create policy "admin all" on public.customers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.drivers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.members for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.push_subscriptions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- pricing (server is the source of truth) ----------
create or replace function public.quote_order(p_items jsonb, p_city text default null, p_phone text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_sub numeric := 0; v_lines jsonb := '[]'::jsonb; r record;
  v_phone text := public.norm_phone(p_phone);
  v_tier public.tiers%rowtype; v_has_tier boolean := false; v_disc numeric := 0;
  v_zone public.zones%rowtype; v_has_zone boolean := false; v_fee numeric := 0;
  v_base numeric; v_after numeric; v_errors text[] := '{}';
begin
  select base_min into v_base from public.store_settings where id = 1;
  for r in
    select p.id, p.name, p.price, p.stock, p.active, greatest(0, least(50, coalesce((i.v->>'qty')::int, 0))) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i(v)
    left join public.products p on p.id = (i.v->>'id')::uuid
  loop
    if r.id is null or not r.active then
      v_errors := v_errors || 'An item in your cart is no longer on the menu. Take it out of your cart to continue.'::text; continue;
    end if;
    if r.qty < 1 then continue; end if;
    if r.qty > r.stock then
      v_errors := v_errors || format('Only %s left of %s.', r.stock, r.name);
    end if;
    v_sub := v_sub + r.price * r.qty;
    v_lines := v_lines || jsonb_build_object('id', r.id, 'name', r.name, 'price', r.price, 'qty', r.qty);
  end loop;

  if v_phone is not null then
    select t.* into v_tier from public.members m join public.tiers t on t.id = m.tier
      where m.phone = v_phone and m.status = 'active' limit 1;
    v_has_tier := found;
    if v_has_tier then v_disc := round(v_sub * v_tier.pct_off / 100.0, 2); end if;
  end if;
  v_after := v_sub - v_disc;

  if p_city is not null and p_city <> '' then
    select * into v_zone from public.zones where p_city = any (cities) order by min_order limit 1;
    v_has_zone := found;
    if not v_has_zone then
      v_errors := v_errors || 'We don''t deliver to that city yet.'::text;
    elsif v_after < v_zone.min_order and not (v_has_tier and v_tier.waive_fee) then
      v_fee := v_zone.fee;
    end if;
  end if;

  if v_after < v_base then
    v_errors := v_errors || format('Orders must be at least $%s before delivery.', v_base);
  end if;

  return jsonb_build_object(
    'lines', v_lines, 'subtotal', v_sub, 'discount', v_disc,
    'tier', case when v_has_tier then v_tier.id end,
    'tier_name', case when v_has_tier then v_tier.name end,
    'pct_off', case when v_has_tier then v_tier.pct_off end,
    'zone_min', case when v_has_zone then v_zone.min_order end,
    'zone_fee', case when v_has_zone then v_zone.fee end,
    'fee', v_fee, 'total', v_after + v_fee, 'base_min', v_base,
    'errors', to_jsonb(v_errors));
end $fn$;

create or replace function public.place_order(
  p_items jsonb, p_name text, p_phone text, p_address text, p_city text, p_notes text, p_age_ok boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  q jsonb; v_phone text := public.norm_phone(p_phone); v_cust uuid; v_order public.orders%rowtype; l jsonb;
  v_name text := left(trim(coalesce(p_name,'')), 80);
  v_addr text := left(trim(coalesce(p_address,'')), 160);
  v_notes text := nullif(left(trim(coalesce(p_notes,'')), 300), '');
begin
  if not coalesce(p_age_ok, false) then raise exception 'Please confirm you are 21 or older.'; end if;
  if v_phone is null then raise exception 'Enter a 10-digit mobile number.'; end if;
  if length(v_name) < 2 then raise exception 'Add your name.'; end if;
  if length(v_addr) < 4 then raise exception 'Add your street address.'; end if;
  if not (select open from public.store_settings where id = 1) then
    raise exception 'We''re not taking orders right now. Please check back during delivery hours.';
  end if;
  if (select count(*) from public.orders where cust_phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many orders from this number in the last hour. Please call us.';
  end if;

  perform 1 from public.products
    where id in (select (i.v->>'id')::uuid from jsonb_array_elements(p_items) as i(v)) for update;

  q := public.quote_order(p_items, p_city, v_phone);
  if jsonb_array_length(q->'errors') > 0 then raise exception '%', q->'errors'->>0; end if;
  if jsonb_array_length(q->'lines') = 0 then raise exception 'Your cart is empty.'; end if;

  insert into public.customers (phone, name, address, city, notes)
    values (v_phone, v_name, v_addr, p_city, v_notes)
  on conflict (phone) do update
    set name = excluded.name, address = excluded.address, city = excluded.city,
        notes = coalesce(excluded.notes, public.customers.notes), updated_at = now()
  returning id into v_cust;

  for l in select v from jsonb_array_elements(q->'lines') as x(v) loop
    update public.products set stock = stock - (l->>'qty')::int where id = (l->>'id')::uuid;
  end loop;

  insert into public.orders (customer_id, cust_name, cust_phone, address, city, notes, items, subtotal, discount, fee, total, tier)
  values (v_cust, v_name, v_phone, v_addr, p_city, v_notes, q->'lines',
          (q->>'subtotal')::numeric, (q->>'discount')::numeric, (q->>'fee')::numeric, (q->>'total')::numeric, q->>'tier')
  returning * into v_order;

  return jsonb_build_object('code', v_order.code, 'total', v_order.total);
end $fn$;

create or replace function public.apply_membership(p_name text, p_phone text, p_tier text)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare v_phone text := public.norm_phone(p_phone); v_name text := left(trim(coalesce(p_name,'')), 80);
begin
  if v_phone is null then raise exception 'Enter a 10-digit mobile number.'; end if;
  if length(v_name) < 2 then raise exception 'Add your name.'; end if;
  if not exists (select 1 from public.tiers where id = p_tier) then raise exception 'Pick a membership tier.'; end if;
  if exists (select 1 from public.members where phone = v_phone and status = 'active') then
    raise exception 'This number already has an active membership.';
  end if;
  update public.members set name = v_name, tier = p_tier, applied_at = now()
    where phone = v_phone and status = 'pending';
  if not found then
    insert into public.members (phone, name, tier) values (v_phone, v_name, p_tier);
  end if;
  return jsonb_build_object('ok', true, 'phone', v_phone);
end $fn$;

create or replace function public.rsvp_event(p_event uuid, p_going boolean)
returns int language sql volatile security definer set search_path = public as $fn$
  update public.events set rsvp_count = greatest(0, rsvp_count + case when p_going then 1 else -1 end)
  where id = p_event and starts_on >= current_date - 1
  returning rsvp_count
$fn$;

-- ---------- order lifecycle ----------
create or replace function public.order_status_change() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status is distinct from old.status then
    if new.status = 'delivered' then
      new.delivered_at := now();
      new.collected := coalesce(new.collected, new.total);
      update public.customers set id_verified = true where id = new.customer_id;
    end if;
    if new.status = 'cancelled' then
      update public.products p set stock = p.stock + (x.v->>'qty')::int
        from jsonb_array_elements(new.items) as x(v) where p.id = (x.v->>'id')::uuid;
    elsif old.status = 'cancelled' then
      update public.products p set stock = greatest(0, p.stock - (x.v->>'qty')::int)
        from jsonb_array_elements(new.items) as x(v) where p.id = (x.v->>'id')::uuid;
    end if;
  end if;
  if new.cash_in and not old.cash_in then new.cash_in_at := now(); end if;
  return new;
end $fn$;
create trigger orders_status before update on public.orders
  for each row execute function public.order_status_change();

-- ---------- phone push: call the edge function on new orders / applications ----------
create or replace function public.push_hook() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare c public.private_config%rowtype;
begin
  select * into c from public.private_config where id = 1;
  if c.fn_url is not null then
    perform net.http_post(
      url := c.fn_url,
      body := case when tg_table_name = 'orders' then jsonb_build_object('order_id', new.id)
                   else jsonb_build_object('member_id', new.id) end,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', c.hook_secret));
  end if;
  return new;
end $fn$;
create trigger orders_push after insert on public.orders
  for each row execute function public.push_hook();
create trigger members_push after insert on public.members
  for each row when (new.status = 'pending') execute function public.push_hook();

-- ---------- grants ----------
grant execute on function public.quote_order(jsonb, text, text) to anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.apply_membership(text, text, text) to anon, authenticated;
grant execute on function public.rsvp_event(uuid, boolean) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- realtime for the dashboard ----------
alter publication supabase_realtime add table public.orders, public.members;

-- ---------- product photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "admin upload product photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and (select public.is_admin()));
create policy "admin update product photos" on storage.objects for update to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));
create policy "admin remove product photos" on storage.objects for delete to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));

-- trigger functions live outside the public API
create schema if not exists private;
alter function public.push_hook() set schema private;
alter function public.order_status_change() set schema private;
alter function public.first_user_admin() set schema private;
