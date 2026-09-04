-- ROLES ---------------------------------------------------------------
create type public.app_role as enum ('admin', 'dispatcher', 'responder');
create type public.severity_level as enum ('critical', 'high', 'moderate', 'safe');
create type public.incident_status as enum ('new', 'assigned', 'in_progress', 'resolved');
create type public.vehicle_status as enum ('available', 'en_route', 'on_scene', 'returning', 'offline');
create type public.road_state as enum ('open', 'flooded', 'landslide', 'bridge_damaged', 'blocked', 'high_risk');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Operator',
  agency text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, agency)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Operator'), new.raw_user_meta_data->>'agency');
  insert into public.user_roles (user_id, role)
    values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'responder'))
    on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- HOSPITALS -----------------------------------------------------------
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  beds_available int not null default 0,
  trauma_center boolean not null default false,
  contact_label text not null default 'Demo contact',
  is_operational boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.hospitals to anon, authenticated;
grant insert, update, delete on public.hospitals to authenticated;
grant all on public.hospitals to service_role;
alter table public.hospitals enable row level security;
create policy "hospitals public read" on public.hospitals for select to anon, authenticated using (true);
create policy "hospitals admin write" on public.hospitals for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher'));

-- SHELTERS ------------------------------------------------------------
create table public.shelters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  capacity int not null default 0,
  occupancy int not null default 0,
  kind text not null default 'evacuation_shelter',
  created_at timestamptz not null default now()
);
grant select on public.shelters to anon, authenticated;
grant insert, update, delete on public.shelters to authenticated;
grant all on public.shelters to service_role;
alter table public.shelters enable row level security;
create policy "shelters public read" on public.shelters for select to anon, authenticated using (true);
create policy "shelters staff write" on public.shelters for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher'));

-- ROAD CONDITIONS -----------------------------------------------------
create table public.road_conditions (
  id uuid primary key default gen_random_uuid(),
  road_name text not null,
  from_node text not null,
  to_node text not null,
  distance_km numeric(6,2) not null,
  base_minutes int not null,
  state public.road_state not null default 'open',
  risk public.severity_level not null default 'safe',
  note text,
  updated_at timestamptz not null default now()
);
grant select on public.road_conditions to anon, authenticated;
grant insert, update, delete on public.road_conditions to authenticated;
grant all on public.road_conditions to service_role;
alter table public.road_conditions enable row level security;
create policy "roads public read" on public.road_conditions for select to anon, authenticated using (true);
create policy "roads staff write" on public.road_conditions for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher'));

-- DISASTER ALERTS -----------------------------------------------------
create table public.disaster_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  area text not null,
  severity public.severity_level not null default 'moderate',
  detail text,
  issued_at timestamptz not null default now(),
  active boolean not null default true
);
grant select on public.disaster_alerts to anon, authenticated;
grant insert, update, delete on public.disaster_alerts to authenticated;
grant all on public.disaster_alerts to service_role;
alter table public.disaster_alerts enable row level security;
create policy "alerts public read" on public.disaster_alerts for select to anon, authenticated using (true);
create policy "alerts staff write" on public.disaster_alerts for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher'));

-- VEHICLES ------------------------------------------------------------
create table public.emergency_vehicles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null,
  status public.vehicle_status not null default 'available',
  lat double precision not null,
  lng double precision not null,
  destination text,
  eta_minutes int,
  crew int not null default 2,
  home_base text,
  updated_at timestamptz not null default now()
);
grant select on public.emergency_vehicles to anon, authenticated;
grant insert, update, delete on public.emergency_vehicles to authenticated;
grant all on public.emergency_vehicles to service_role;
alter table public.emergency_vehicles enable row level security;
create policy "vehicles public read" on public.emergency_vehicles for select to anon, authenticated using (true);
create policy "vehicles staff write" on public.emergency_vehicles for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher') or public.has_role(auth.uid(),'responder')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher') or public.has_role(auth.uid(),'responder'));

-- INCIDENTS -----------------------------------------------------------
create table public.emergency_incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('RX-' || lpad((floor(random()*9000+1000))::text, 4, '0')),
  incident_type text not null,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  severity public.severity_level not null default 'high',
  people_affected int not null default 0,
  road_accessible boolean not null default true,
  required_service text not null default 'ambulance',
  status public.incident_status not null default 'new',
  ai_confidence int not null default 80,
  reports_fused int not null default 1,
  summary text,
  assigned_vehicle uuid references public.emergency_vehicles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select on public.emergency_incidents to anon, authenticated;
grant insert, update, delete on public.emergency_incidents to authenticated;
grant all on public.emergency_incidents to service_role;
alter table public.emergency_incidents enable row level security;
create policy "incidents public read" on public.emergency_incidents for select to anon, authenticated using (true);
create policy "incidents insert authed" on public.emergency_incidents for insert to authenticated with check (auth.uid() is not null);
create policy "incidents update staff" on public.emergency_incidents for update to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'dispatcher') or created_by = auth.uid());
create policy "incidents delete admin" on public.emergency_incidents for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ROUTES --------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.emergency_incidents(id) on delete cascade,
  origin text not null,
  destination text not null,
  label text not null,
  path text[] not null default '{}',
  distance_km numeric(6,2) not null default 0,
  eta_minutes int not null default 0,
  risk public.severity_level not null default 'safe',
  recommended boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
grant select on public.routes to anon, authenticated;
grant insert, update, delete on public.routes to authenticated;
grant all on public.routes to service_role;
alter table public.routes enable row level security;
create policy "routes public read" on public.routes for select to anon, authenticated using (true);
create policy "routes authed write" on public.routes for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

-- SEED ----------------------------------------------------------------
insert into public.hospitals (name, district, lat, lng, beds_available, trauma_center, contact_label) values
 ('Bir Hospital Trauma Centre','Kathmandu',27.7052,85.3138,24,true,'Demo contact - not a real number'),
 ('Patan Hospital','Lalitpur',27.6690,85.3206,12,true,'Demo contact - not a real number'),
 ('Bharatpur Regional Hospital','Chitwan',27.6710,84.4370,31,true,'Demo contact - not a real number'),
 ('Dhulikhel Community Hospital','Kavre',27.6180,85.5390,9,false,'Demo contact - not a real number'),
 ('Koshi Zonal Hospital','Morang',26.4530,87.2710,18,true,'Demo contact - not a real number');

insert into public.shelters (name, district, lat, lng, capacity, occupancy, kind) values
 ('Tundikhel Relief Camp','Kathmandu',27.7030,85.3160,800,412,'evacuation_shelter'),
 ('Bhaktapur Community Hall','Bhaktapur',27.6710,85.4290,350,286,'evacuation_shelter'),
 ('Narayanghat School Shelter','Chitwan',27.6900,84.4300,500,178,'evacuation_shelter'),
 ('Kavre Rescue Command Post','Kavre',27.6250,85.5410,120,44,'rescue_center'),
 ('Biratnagar Flood Camp','Morang',26.4820,87.2830,650,533,'evacuation_shelter');

insert into public.road_conditions (road_name, from_node, to_node, distance_km, base_minutes, state, risk, note) values
 ('Araniko Highway (Sanga stretch)','Kathmandu','Dhulikhel',28.40,42,'flooded','critical','Water above 1.2m near Sanga underpass; impassable for light vehicles.'),
 ('Bagmati Bridge - Balkhu','Kathmandu','Lalitpur',4.20,9,'bridge_damaged','critical','Deck cracking reported after surge; closed to all traffic.'),
 ('Prithvi Highway (Malekhu segment)','Kathmandu','Chitwan',146.00,210,'landslide','high','Single-lane debris clearance ongoing; convoy escort required.'),
 ('Kalanki - Thankot Corridor','Kathmandu','Thankot',9.80,17,'high_risk','high','Slope saturation; risk of secondary slide during rainfall.'),
 ('Ring Road North','Kathmandu','Chabahil',6.10,12,'open','safe','Clear, all lanes open.'),
 ('Kanti Rajpath (alternate)','Kathmandu','Chitwan',163.00,255,'open','moderate','Longer but currently accessible; narrow curves.'),
 ('Sanga Bypass Track','Kathmandu','Dhulikhel',34.60,58,'open','safe','Gravel bypass verified open by field team at 05:40.'),
 ('Chandragiri Link','Thankot','Chitwan',138.00,205,'open','moderate','Open with reduced speed limit.'),
 ('East-West Highway (Itahari link)','Morang','Koshi',22.50,30,'flooded','high','Standing water 40cm; heavy vehicles only.'),
 ('Bhaktapur Inner Loop','Bhaktapur','Kathmandu',13.20,24,'open','safe','Open, light congestion.');

insert into public.disaster_alerts (title, category, area, severity, detail) values
 ('Bagmati basin flood surge','flood','Kathmandu / Lalitpur','critical','River level 1.8m above warning threshold. Evacuation advised for low-lying wards.'),
 ('Landslide activity - Malekhu','landslide','Dhading corridor','high','Two active slide zones on Prithvi Highway; intermittent closures.'),
 ('Bridge structural damage - Balkhu','bridge_damage','Kathmandu','critical','Bagmati bridge closed pending engineering assessment.'),
 ('Heavy rainfall warning','weather','Central & Eastern Nepal','high','120-180mm expected in next 24h. Expect new road closures.'),
 ('Koshi embankment watch','flood','Morang','moderate','Embankment seepage monitored; no breach reported.'),
 ('Dhulikhel corridor reopened','accessibility','Kavre','safe','Gravel bypass verified accessible for ambulances.');

insert into public.emergency_vehicles (code, kind, status, lat, lng, destination, eta_minutes, crew, home_base) values
 ('AMB-101','ambulance','en_route',27.7020,85.3200,'Bir Hospital Trauma Centre',7,3,'Kathmandu'),
 ('AMB-104','ambulance','available',27.6700,85.3210,null,null,2,'Lalitpur'),
 ('AMB-207','ambulance','on_scene',27.6890,84.4310,'Narayanghat School Shelter',0,3,'Chitwan'),
 ('RES-311','rescue_truck','en_route',27.6220,85.5380,'Kavre Rescue Command Post',14,6,'Kavre'),
 ('FIRE-402','fire_engine','available',27.7080,85.3080,null,null,5,'Kathmandu'),
 ('BOAT-512','rescue_boat','on_scene',26.4790,87.2810,'Biratnagar Flood Camp',0,4,'Morang'),
 ('AMB-118','ambulance','returning',27.6740,85.4270,'Bhaktapur Community Hall',19,2,'Bhaktapur'),
 ('HELI-900','air_ambulance','offline',27.6960,85.3590,null,null,3,'Kathmandu');

insert into public.emergency_incidents (reference, incident_type, location_name, lat, lng, severity, people_affected, road_accessible, required_service, status, ai_confidence, reports_fused, summary) values
 ('RX-1042','road_accident','Kalanki junction, Kathmandu',27.6935,85.2810,'critical',3,true,'ambulance','in_progress',94,7,'Two vehicles appear to have collided. Three people may need assistance and traffic is partially blocked.'),
 ('RX-1057','flood_rescue','Balkhu riverside settlement',27.6845,85.3010,'critical',9,true,'rescue_team','assigned',89,12,'Rising water trapping residents on ground floors; boat support requested.'),
 ('RX-1063','landslide','Malekhu, Prithvi Highway',27.8100,84.8800,'high',6,false,'rescue_team','new',82,4,'Debris covering carriageway; vehicles reported stranded on both sides.'),
 ('RX-1071','medical_emergency','Bhaktapur Durbar area',27.6720,85.4280,'moderate',1,true,'ambulance','assigned',76,2,'Elderly patient reported with breathing difficulty.'),
 ('RX-1080','structure_collapse','Biratnagar ward 6',26.4780,87.2790,'high',4,true,'fire_response','in_progress',85,5,'Partial wall collapse after prolonged flooding.'),
 ('RX-1088','road_blockage','Sanga stretch, Araniko Highway',27.6400,85.4700,'moderate',0,false,'traffic_support','resolved',91,3,'Flood water blocking highway; bypass route published to field teams.');