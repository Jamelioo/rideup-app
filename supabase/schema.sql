-- RideUp Nassau — Database Schema
-- Run this in Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────
-- RIDERS
-- ─────────────────────────────────────────
create table riders (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) unique,
  name text not null,
  phone text not null unique,
  email text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- DRIVERS
-- ─────────────────────────────────────────
create table drivers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) unique,
  name text not null,
  phone text not null unique,
  email text,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  vehicle_type text default 'standard', -- 'standard' | 'xl'
  status text default 'offline',        -- 'offline' | 'online' | 'on_trip'
  rating numeric(2,1) default 5.0,
  total_trips int default 0,
  approved boolean default false,        -- manual approval before they can go online
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- RIDES
-- ─────────────────────────────────────────
create table rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid references riders(id) not null,
  driver_id uuid references drivers(id),                -- null until matched

  status text default 'requested',
  -- 'requested' | 'pending_driver_response' | 'accepted' |
  -- 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled'

  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,

  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,

  vehicle_type text default 'standard',  -- 'standard' | 'xl'
  distance_miles numeric(5,2),
  fare_cents int not null,

  declined_by uuid[] default '{}',       -- driver ids who declined, so we skip them on rematch

  requested_at timestamptz default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- ─────────────────────────────────────────
-- DRIVER LIVE LOCATIONS
-- separate small table, updated frequently — keep it lean
-- ─────────────────────────────────────────
create table driver_locations (
  driver_id uuid primary key references drivers(id),
  lat double precision not null,
  lng double precision not null,
  heading numeric,
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- INDEXES for common queries
-- ─────────────────────────────────────────
create index idx_rides_rider on rides(rider_id);
create index idx_rides_driver on rides(driver_id);
create index idx_rides_status on rides(status);
create index idx_drivers_status on drivers(status) where status = 'online';

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Riders/drivers can only see their own data; ride rows are visible
-- to the rider and driver involved.
-- ─────────────────────────────────────────
alter table riders enable row level security;
alter table drivers enable row level security;
alter table rides enable row level security;
alter table driver_locations enable row level security;

create policy "Riders can view/edit their own row"
  on riders for all
  using (auth.uid() = auth_user_id);

create policy "Drivers can view/edit their own row"
  on drivers for all
  using (auth.uid() = auth_user_id);

create policy "Riders can view their own rides"
  on rides for select
  using (rider_id in (select id from riders where auth_user_id = auth.uid()));

create policy "Riders can create rides"
  on rides for insert
  with check (rider_id in (select id from riders where auth_user_id = auth.uid()));

create policy "Drivers can view rides assigned to them or unassigned+requested"
  on rides for select
  using (
    driver_id in (select id from drivers where auth_user_id = auth.uid())
    or status = 'requested'
  );

create policy "Drivers can update rides assigned to them"
  on rides for update
  using (driver_id in (select id from drivers where auth_user_id = auth.uid()));

create policy "Anyone can view online driver locations"
  on driver_locations for select
  using (true);

create policy "Drivers can update their own location"
  on driver_locations for all
  using (driver_id in (select id from drivers where auth_user_id = auth.uid()));

-- ─────────────────────────────────────────
-- REALTIME
-- Enable realtime on rides + driver_locations so the frontend
-- can subscribe to live changes (ride status updates, driver position)
-- ─────────────────────────────────────────
alter publication supabase_realtime add table rides;
alter publication supabase_realtime add table driver_locations;
