-- Distress Finder — Phase 1 schema
-- Run in the Supabase SQL editor (or `supabase db push`).
create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  parcel text,
  dedupe_key text not null unique,
  address text not null,
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  county text,
  geom geography(Point, 4326),
  lat double precision,
  lng double precision,
  owner_name text,
  owner_first text,
  owner_last text,
  owner_is_business boolean,
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  absentee boolean,
  beds numeric,
  baths numeric,
  sqft integer,
  lot_sqft integer,
  year_built integer,
  property_type text,
  last_sale_date date,
  last_sale_price numeric,
  est_value numeric,
  mortgage_balance numeric,
  est_equity numeric,
  est_equity_pct numeric,
  years_owned integer,
  distress_types text[] not null default '{}',
  lead_status text not null default 'new' check (lead_status in ('new','lead','skip','watch')),
  distress_score integer,
  image_flags text[],
  needs_review boolean,
  photos jsonb not null default '[]',
  source text not null,
  source_date date not null,
  import_batch_id uuid,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_geom_idx on properties using gist (geom);
create index if not exists properties_state_county_idx on properties (state, county);
create index if not exists properties_lead_status_idx on properties (lead_status);

-- Every lien / foreclosure / tax fact carries source + source_date + confidence.
create table if not exists liens (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null,
  case_number text,
  case_type text,
  status text,
  filed_date date,
  amount numeric,
  plaintiff text,
  county text,
  state text,
  source text not null,
  source_date date not null,
  confidence text not null check (confidence in ('confirmed','possible_match','estimate')),
  raw_text text,
  created_at timestamptz not null default now()
);
create index if not exists liens_property_idx on liens (property_id);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_at timestamptz not null default now(),
  rows_in integer not null,
  rows_new integer not null,
  rows_updated integer not null,
  rows_deduped integer not null,
  rows_skipped integer not null,
  unmapped_columns text[] not null default '{}'
);

-- Image scoring cache, keyed on parcel + image date (Section 4 of the blueprint).
create table if not exists score_cache (
  cache_key text primary key,
  property_id uuid references properties(id) on delete cascade,
  result jsonb not null,
  model text not null,
  cost_usd numeric not null default 0,
  scored_at timestamptz not null default now()
);

-- Daily AI spend ledger: enforces the spend cap.
create table if not exists ai_spend (
  day date primary key,
  scans integer not null default 0,
  cost_usd numeric not null default 0
);

-- Cached BatchData lookups so repeat views are free.
create table if not exists lookup_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
