-- Milking Distribuidora — Schema para cotações
-- Rodar no Supabase SQL Editor (supabase.com → projeto → SQL Editor)

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_code    text not null unique,
  created_at    timestamptz not null default now(),
  cnpj          text not null,
  customer_name text not null,
  whatsapp      text not null,
  city          text,
  store_type    text,
  items         jsonb not null,
  item_count    int not null,
  notes         text,
  order_url     text,
  source        text default 'website'
);

create index quotes_cnpj_idx on public.quotes(cnpj);
create index quotes_created_at_idx on public.quotes(created_at desc);

-- RLS: anon pode inserir, só authenticated pode ler
alter table public.quotes enable row level security;

create policy "anon can insert quotes"
  on public.quotes for insert to anon with check (true);

create policy "authenticated can read quotes"
  on public.quotes for select to authenticated using (true);
