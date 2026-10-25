-- NFL Parlay Tracker schema
-- Run this in the Supabase SQL editor

create table if not exists parlays (
  id          uuid primary key,
  name        text not null,
  stake       numeric,
  odds        integer,
  payout      numeric,
  status      text default 'pending',
  game_date   text,
  created_at  timestamptz default now()
);

create table if not exists legs (
  id              uuid primary key,
  parlay_id       uuid references parlays(id) on delete cascade,
  type            text,
  description     text,
  team            text,
  opponent        text,
  line            numeric,
  direction       text,
  odds            integer,
  player_name     text,
  prop_type       text,
  game_id         text,
  game_date       text,
  status          text default 'pending',
  current_value   numeric,
  win_probability numeric,
  created_at      timestamptz default now()
);

-- Enable Realtime so the browser receives live updates without polling
alter publication supabase_realtime add table parlays;
alter publication supabase_realtime add table legs;
