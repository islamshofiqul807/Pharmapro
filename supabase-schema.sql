-- =============================================================
-- PharmaPro Database Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================================

-- 1. Pharmacies (one per user account)
create table if not exists public.pharmacies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null unique,
  name         text not null,
  owner_name   text,
  phone        text,
  address      text,
  license_no   text,
  plan         text not null default 'free' check (plan in ('free', 'pro', 'business')),
  created_at   timestamptz default now()
);

-- 2. Medicines
create table if not exists public.medicines (
  id              uuid primary key default gen_random_uuid(),
  pharmacy_id     uuid references public.pharmacies(id) on delete cascade not null,
  name            text not null,
  generic_name    text,
  brand           text,
  category        text default 'tablet',
  unit            text default 'pcs',
  purchase_price  numeric(10,2) default 0,
  sale_price      numeric(10,2) default 0,
  stock_qty       integer default 0,
  reorder_level   integer default 10,
  rack_location   text,
  created_at      timestamptz default now()
);

-- 3. Batches (for expiry tracking — FEFO logic)
create table if not exists public.batches (
  id              uuid primary key default gen_random_uuid(),
  pharmacy_id     uuid references public.pharmacies(id) on delete cascade not null,
  medicine_id     uuid references public.medicines(id) on delete cascade not null,
  batch_no        text not null,
  mfg_date        date,
  expiry_date     date not null,
  qty             integer default 0,
  purchase_price  numeric(10,2) default 0,
  created_at      timestamptz default now()
);

-- 4. Suppliers
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  pharmacy_id  uuid references public.pharmacies(id) on delete cascade not null,
  name         text not null,
  phone        text,
  address      text,
  balance      numeric(10,2) default 0,
  created_at   timestamptz default now()
);

-- 5. Purchases
create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  pharmacy_id    uuid references public.pharmacies(id) on delete cascade not null,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  total          numeric(10,2) default 0,
  paid           numeric(10,2) default 0,
  due            numeric(10,2) default 0,
  purchase_date  date not null default current_date,
  notes          text,
  created_at     timestamptz default now()
);

-- 6. Purchase items
create table if not exists public.purchase_items (
  id           uuid primary key default gen_random_uuid(),
  purchase_id  uuid references public.purchases(id) on delete cascade not null,
  medicine_id  uuid references public.medicines(id) on delete restrict not null,
  batch_id     uuid references public.batches(id) on delete set null,
  qty          integer not null,
  unit_price   numeric(10,2) not null,
  created_at   timestamptz default now()
);

-- 7. Sales
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  pharmacy_id    uuid references public.pharmacies(id) on delete cascade not null,
  customer_name  text default 'Walk-in customer',
  total          numeric(10,2) default 0,
  discount       numeric(10,2) default 0,
  paid           numeric(10,2) default 0,
  sale_date      date not null default current_date,
  notes          text,
  created_at     timestamptz default now()
);

-- 8. Sale items
create table if not exists public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid references public.sales(id) on delete cascade not null,
  pharmacy_id  uuid references public.pharmacies(id) on delete cascade not null,
  medicine_id  uuid references public.medicines(id) on delete restrict not null,
  batch_id     uuid references public.batches(id) on delete set null,
  qty          integer not null,
  unit_price   numeric(10,2) not null,
  sale_price   numeric(10,2) not null,
  created_at   timestamptz default now()
);

-- =============================================================
-- ROW LEVEL SECURITY (each pharmacy only sees its own data)
-- =============================================================
alter table public.pharmacies   enable row level security;
alter table public.medicines    enable row level security;
alter table public.batches      enable row level security;
alter table public.suppliers    enable row level security;
alter table public.purchases    enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales        enable row level security;
alter table public.sale_items   enable row level security;

-- Helper: get current user's pharmacy_id
create or replace function public.my_pharmacy_id()
returns uuid language sql stable security definer as $$
  select id from public.pharmacies where user_id = auth.uid() limit 1;
$$;

-- Policies for pharmacies
create policy "pharmacies: owner access" on public.pharmacies
  for all using (user_id = auth.uid());

-- Policies for medicines
create policy "medicines: pharmacy access" on public.medicines
  for all using (pharmacy_id = public.my_pharmacy_id());

-- Policies for batches
create policy "batches: pharmacy access" on public.batches
  for all using (pharmacy_id = public.my_pharmacy_id());

-- Policies for suppliers
create policy "suppliers: pharmacy access" on public.suppliers
  for all using (pharmacy_id = public.my_pharmacy_id());

-- Policies for purchases
create policy "purchases: pharmacy access" on public.purchases
  for all using (pharmacy_id = public.my_pharmacy_id());

-- Policies for purchase_items
create policy "purchase_items: pharmacy access" on public.purchase_items
  for all using (purchase_id in (
    select id from public.purchases where pharmacy_id = public.my_pharmacy_id()
  ));

-- Policies for sales
create policy "sales: pharmacy access" on public.sales
  for all using (pharmacy_id = public.my_pharmacy_id());

-- Policies for sale_items
create policy "sale_items: pharmacy access" on public.sale_items
  for all using (pharmacy_id = public.my_pharmacy_id());

-- =============================================================
-- TRIGGER: Auto-create pharmacy on signup
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pharmacies (user_id, name, owner_name, phone, license_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pharmacy_name', 'My Pharmacy'),
    coalesce(new.raw_user_meta_data->>'owner_name', 'Owner'),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'license_no', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- INDEXES for performance
-- =============================================================
create index if not exists idx_medicines_pharmacy on public.medicines(pharmacy_id);
create index if not exists idx_batches_pharmacy on public.batches(pharmacy_id);
create index if not exists idx_batches_expiry on public.batches(expiry_date);
create index if not exists idx_sales_pharmacy on public.sales(pharmacy_id);
create index if not exists idx_sales_date on public.sales(sale_date);
create index if not exists idx_purchases_pharmacy on public.purchases(pharmacy_id);
create index if not exists idx_sale_items_pharmacy on public.sale_items(pharmacy_id);

-- =============================================================
-- NEW TABLES (Phase 2 features)
-- =============================================================

-- Customers with credit tracking
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_id   uuid references public.pharmacies(id) on delete cascade not null,
  name          text not null,
  phone         text,
  address       text,
  credit_limit  numeric(10,2) default 5000,
  total_due     numeric(10,2) default 0,
  total_paid    numeric(10,2) default 0,
  created_at    timestamptz default now()
);

-- Customer payment receipts
create table if not exists public.customer_payments (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_id   uuid references public.pharmacies(id) on delete cascade not null,
  customer_id   uuid references public.customers(id) on delete cascade not null,
  amount        numeric(10,2) not null,
  note          text,
  created_at    timestamptz default now()
);

-- Add customer_id to sales
alter table public.sales add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Staff members
create table if not exists public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_id   uuid references public.pharmacies(id) on delete cascade not null,
  name          text not null,
  email         text not null,
  role          text not null default 'pharmacist' check (role in ('manager','pharmacist','cashier','viewer')),
  permissions   text[] default '{}',
  status        text not null default 'invited' check (status in ('invited','active','suspended')),
  invited_at    timestamptz default now(),
  last_active   timestamptz,
  created_at    timestamptz default now(),
  unique(pharmacy_id, email)
);

-- SMS / alert logs
create table if not exists public.alert_logs (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_id   uuid references public.pharmacies(id) on delete cascade not null,
  type          text not null,
  message       text,
  status        text not null default 'sent',
  recipient     text,
  created_at    timestamptz default now()
);

-- Barcode field on medicines
alter table public.medicines add column if not exists barcode text;

-- =============================================================
-- RLS for new tables
-- =============================================================
alter table public.customers         enable row level security;
alter table public.customer_payments enable row level security;
alter table public.staff_members     enable row level security;
alter table public.alert_logs        enable row level security;

create policy "customers: pharmacy access"         on public.customers         for all using (pharmacy_id = public.my_pharmacy_id());
create policy "customer_payments: pharmacy access" on public.customer_payments for all using (pharmacy_id = public.my_pharmacy_id());
create policy "staff_members: pharmacy access"     on public.staff_members     for all using (pharmacy_id = public.my_pharmacy_id());
create policy "alert_logs: pharmacy access"        on public.alert_logs        for all using (pharmacy_id = public.my_pharmacy_id());

-- Indexes
create index if not exists idx_customers_pharmacy     on public.customers(pharmacy_id);
create index if not exists idx_staff_pharmacy         on public.staff_members(pharmacy_id);
create index if not exists idx_alert_logs_pharmacy    on public.alert_logs(pharmacy_id);
create index if not exists idx_medicines_barcode      on public.medicines(barcode) where barcode is not null;
