-- Phase 1.1: contact fields from skip-trace exports, LTV, geocode status, remembered CSV layouts
alter table properties
  add column if not exists phones text[],
  add column if not exists emails text[],
  add column if not exists tags text[],
  add column if not exists ltv_pct numeric,
  add column if not exists geocode_status text;

create table if not exists column_maps (
  signature text primary key,
  headers text[] not null,
  mapping jsonb not null,
  saved_at timestamptz not null default now()
);
