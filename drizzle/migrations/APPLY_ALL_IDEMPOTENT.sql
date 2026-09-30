-- ============================================================
-- RESH MESQ — COMPLETE DATABASE SETUP (IDEMPOTENT)
-- ============================================================
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- It is safe to run multiple times — uses IF NOT EXISTS throughout.
-- ============================================================

-- ── ENUMS (create only if missing) ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'dispatcher', 'responder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.severity_level AS ENUM ('critical', 'high', 'moderate', 'safe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM ('new', 'assigned', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('available', 'en_route', 'on_scene', 'returning', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.road_state AS ENUM ('open', 'flooded', 'landslide', 'bridge_damaged', 'blocked', 'high_risk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PROFILES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL DEFAULT 'Operator',
  agency      text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "profiles readable by authenticated"
    ON public.profiles FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "own profile insert"
    ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "own profile update"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── USER ROLES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DO $$ BEGIN
  CREATE POLICY "read own roles"
    ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "insert own role"
    ON public.user_roles FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, agency)
    VALUES (new.id,
            COALESCE(new.raw_user_meta_data->>'full_name', 'Operator'),
            new.raw_user_meta_data->>'agency');
  INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'responder'))
    ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── HOSPITALS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hospitals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  district        text        NOT NULL,
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  beds_available  int         NOT NULL DEFAULT 0,
  trauma_center   boolean     NOT NULL DEFAULT false,
  contact_label   text        NOT NULL DEFAULT 'Demo contact',
  is_operational  boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hospitals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "hospitals public read"
    ON public.hospitals FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hospitals admin write"
    ON public.hospitals FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── SHELTERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shelters (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  district   text        NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  capacity   int         NOT NULL DEFAULT 0,
  occupancy  int         NOT NULL DEFAULT 0,
  kind       text        NOT NULL DEFAULT 'evacuation_shelter',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shelters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shelters TO authenticated;
GRANT ALL ON public.shelters TO service_role;
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "shelters public read"
    ON public.shelters FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "shelters staff write"
    ON public.shelters FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ROAD CONDITIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.road_conditions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  road_name    text        NOT NULL,
  from_node    text        NOT NULL,
  to_node      text        NOT NULL,
  distance_km  numeric(6,2) NOT NULL,
  base_minutes int         NOT NULL,
  state        public.road_state NOT NULL DEFAULT 'open',
  risk         public.severity_level NOT NULL DEFAULT 'safe',
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.road_conditions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.road_conditions TO authenticated;
GRANT ALL ON public.road_conditions TO service_role;
ALTER TABLE public.road_conditions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "roads public read"
    ON public.road_conditions FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "roads staff write"
    ON public.road_conditions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DISASTER ALERTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disaster_alerts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  category   text        NOT NULL,
  area       text        NOT NULL,
  severity   public.severity_level NOT NULL DEFAULT 'moderate',
  detail     text,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  active     boolean     NOT NULL DEFAULT true
);
GRANT SELECT ON public.disaster_alerts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.disaster_alerts TO authenticated;
GRANT ALL ON public.disaster_alerts TO service_role;
ALTER TABLE public.disaster_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "alerts public read"
    ON public.disaster_alerts FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "alerts staff write"
    ON public.disaster_alerts FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── EMERGENCY VEHICLES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_vehicles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        NOT NULL UNIQUE,
  kind         text        NOT NULL,
  status       public.vehicle_status NOT NULL DEFAULT 'available',
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  destination  text,
  eta_minutes  int,
  crew         int         NOT NULL DEFAULT 2,
  home_base    text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.emergency_vehicles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.emergency_vehicles TO authenticated;
GRANT ALL ON public.emergency_vehicles TO service_role;
ALTER TABLE public.emergency_vehicles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vehicles public read"
    ON public.emergency_vehicles FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vehicles staff write"
    ON public.emergency_vehicles FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'dispatcher') OR
      public.has_role(auth.uid(), 'responder')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'dispatcher') OR
      public.has_role(auth.uid(), 'responder')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── EMERGENCY INCIDENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        text        NOT NULL UNIQUE DEFAULT ('RX-' || lpad((floor(random()*9000+1000))::text, 4, '0')),
  incident_type    text        NOT NULL,
  location_name    text        NOT NULL,
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  severity         public.severity_level NOT NULL DEFAULT 'high',
  people_affected  int         NOT NULL DEFAULT 0,
  road_accessible  boolean     NOT NULL DEFAULT true,
  required_service text        NOT NULL DEFAULT 'ambulance',
  status           public.incident_status NOT NULL DEFAULT 'new',
  ai_confidence    int         NOT NULL DEFAULT 80,
  reports_fused    int         NOT NULL DEFAULT 1,
  summary          text,
  assigned_vehicle uuid        REFERENCES public.emergency_vehicles(id) ON DELETE SET NULL,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);
GRANT SELECT ON public.emergency_incidents TO anon, authenticated;
GRANT INSERT ON public.emergency_incidents TO anon, authenticated;
GRANT UPDATE, DELETE ON public.emergency_incidents TO authenticated;
GRANT ALL ON public.emergency_incidents TO service_role;
ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "incidents public read"
    ON public.emergency_incidents FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can insert (created_by = their uid)
DO $$ BEGIN
  CREATE POLICY "incidents insert authed"
    ON public.emergency_incidents FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anonymous SOS: created_by must be NULL
DO $$ BEGIN
  CREATE POLICY "incidents insert anon sos"
    ON public.emergency_incidents FOR INSERT TO anon
    WITH CHECK (created_by IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incidents update staff"
    ON public.emergency_incidents FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'dispatcher') OR
      created_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "incidents delete admin"
    ON public.emergency_incidents FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ROUTES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
  origin       text        NOT NULL,
  destination  text        NOT NULL,
  label        text        NOT NULL,
  path         text[]      NOT NULL DEFAULT '{}',
  distance_km  numeric(6,2) NOT NULL DEFAULT 0,
  eta_minutes  int         NOT NULL DEFAULT 0,
  risk         public.severity_level NOT NULL DEFAULT 'safe',
  recommended  boolean     NOT NULL DEFAULT false,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.routes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "routes public read"
    ON public.routes FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "routes authed write"
    ON public.routes FOR ALL TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── FAMILY CONTACTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_contacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  full_name     text        NOT NULL,
  relation      text        NOT NULL DEFAULT 'family',
  phone         text        NOT NULL,
  notify_by_sms boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_contacts TO authenticated;
GRANT ALL ON public.family_contacts TO service_role;
ALTER TABLE public.family_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own family contacts"
    ON public.family_contacts FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── CAMERA FEEDS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.camera_feeds (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text        NOT NULL,
  district       text        NOT NULL,
  owner_kind     text        NOT NULL DEFAULT 'public',
  lat            double precision NOT NULL,
  lng            double precision NOT NULL,
  authorized     boolean     NOT NULL DEFAULT false,
  last_frame_at  timestamptz NOT NULL DEFAULT now(),
  note           text
);
GRANT SELECT ON public.camera_feeds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camera_feeds TO authenticated;
GRANT ALL ON public.camera_feeds TO service_role;
ALTER TABLE public.camera_feeds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cameras public read"
    ON public.camera_feeds FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cameras staff write"
    ON public.camera_feeds FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── MISSING PERSONS ── THE TABLE THAT WAS MISSING ────────────────────────────
CREATE TABLE IF NOT EXISTS public.missing_persons (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             text        NOT NULL UNIQUE DEFAULT ('MP-' || lpad((floor(random()*9000+1000))::text, 4, '0')),
  full_name           text        NOT NULL,
  approximate_age     int         NOT NULL CHECK (approximate_age BETWEEN 0 AND 120),
  gender              text        NOT NULL DEFAULT 'not_specified',
  clothing_desc       text,
  identifying_desc    text,
  last_known_location text        NOT NULL,
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  lat                 double precision,
  lng                 double precision,
  photo_url           text,
  reporter_name       text        NOT NULL,
  reporter_contact    text        NOT NULL,
  status              text        NOT NULL DEFAULT 'reported'
                      CHECK (status IN ('reported','verified','search_in_progress','located','closed')),
  notes               text,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT INSERT ON public.missing_persons TO anon, authenticated;
GRANT SELECT, UPDATE ON public.missing_persons TO authenticated;
GRANT ALL ON public.missing_persons TO service_role;

ALTER TABLE public.missing_persons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anyone can report missing person"
    ON public.missing_persons FOR INSERT TO anon, authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "responders can read missing persons"
    ON public.missing_persons FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "responders can update status"
    ON public.missing_persons FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'dispatcher') OR
      public.has_role(auth.uid(), 'responder')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS missing_persons_updated_at ON public.missing_persons;
CREATE TRIGGER missing_persons_updated_at
  BEFORE UPDATE ON public.missing_persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── SEED DATA (only if tables are empty) ─────────────────────────────────────

-- Hospitals
INSERT INTO public.hospitals (name, district, lat, lng, beds_available, trauma_center, contact_label)
SELECT * FROM (VALUES
  ('Bir Hospital Trauma Centre','Kathmandu',27.7052,85.3138,24,true,'Demo contact - not a real number'),
  ('Patan Hospital','Lalitpur',27.6690,85.3206,12,true,'Demo contact - not a real number'),
  ('Bharatpur Regional Hospital','Chitwan',27.6710,84.4370,31,true,'Demo contact - not a real number'),
  ('Dhulikhel Community Hospital','Kavre',27.6180,85.5390,9,false,'Demo contact - not a real number'),
  ('Koshi Zonal Hospital','Morang',26.4530,87.2710,18,true,'Demo contact - not a real number')
) AS v(name, district, lat, lng, beds_available, trauma_center, contact_label)
WHERE NOT EXISTS (SELECT 1 FROM public.hospitals LIMIT 1);

-- Shelters
INSERT INTO public.shelters (name, district, lat, lng, capacity, occupancy, kind)
SELECT * FROM (VALUES
  ('Tundikhel Relief Camp','Kathmandu',27.7030,85.3160,800,412,'evacuation_shelter'),
  ('Bhaktapur Community Hall','Bhaktapur',27.6710,85.4290,350,286,'evacuation_shelter'),
  ('Narayanghat School Shelter','Chitwan',27.6900,84.4300,500,178,'evacuation_shelter'),
  ('Kavre Rescue Command Post','Kavre',27.6250,85.5410,120,44,'rescue_center'),
  ('Biratnagar Flood Camp','Morang',26.4820,87.2830,650,533,'evacuation_shelter')
) AS v(name, district, lat, lng, capacity, occupancy, kind)
WHERE NOT EXISTS (SELECT 1 FROM public.shelters LIMIT 1);

-- Road conditions (primary roads — including hazardous ones for demo)
INSERT INTO public.road_conditions (road_name, from_node, to_node, distance_km, base_minutes, state, risk, note)
SELECT * FROM (VALUES
  ('Araniko Highway (Sanga stretch)','Kathmandu','Dhulikhel',28.40,42,'flooded'::public.road_state,'critical'::public.severity_level,'Water above 1.2m near Sanga underpass; impassable for light vehicles.'),
  ('Bagmati Bridge - Balkhu','Kathmandu','Lalitpur',4.20,9,'bridge_damaged','critical','Deck cracking reported after surge; closed to all traffic.'),
  ('Prithvi Highway (Malekhu segment)','Kathmandu','Chitwan',146.00,210,'landslide','high','Single-lane debris clearance ongoing; convoy escort required.'),
  ('Kalanki - Thankot Corridor','Kathmandu','Thankot',9.80,17,'high_risk','high','Slope saturation; risk of secondary slide during rainfall.'),
  ('Ring Road North','Kathmandu','Chabahil',6.10,12,'open','safe','Clear, all lanes open.'),
  ('Kanti Rajpath (alternate)','Kathmandu','Chitwan',163.00,255,'open','moderate','Longer but currently accessible; narrow curves.'),
  ('Sanga Bypass Track','Kathmandu','Dhulikhel',34.60,58,'open','safe','Gravel bypass verified open by field team at 05:40.'),
  ('Chandragiri Link','Thankot','Chitwan',138.00,205,'open','moderate','Open with reduced speed limit.'),
  ('East-West Highway (Itahari link)','Morang','Koshi',22.50,30,'flooded','high','Standing water 40cm; heavy vehicles only.'),
  ('Bhaktapur Inner Loop','Bhaktapur','Kathmandu',13.20,24,'open','safe','Open, light congestion.'),
  -- Additional open/alternate roads (from migration 0003)
  ('Bhaktapur-Lalitpur Link Road','Lalitpur','Bhaktapur',11.50,22,'open','safe','Open; minor waterlogging at underpasses cleared.'),
  ('Arniko Alternate - Bhaktapur to Dhulikhel','Bhaktapur','Dhulikhel',19.80,36,'high_risk','high','Narrow hill road; passable for ambulances.'),
  ('Ring Road East Spur','Chabahil','Bhaktapur',10.20,19,'open','safe','All lanes open; normal traffic.'),
  ('Chabahil-Dhulikhel Outer Road','Chabahil','Dhulikhel',22.40,38,'open','moderate','Open; some sections narrow.'),
  ('Lalitpur-Thankot Southern Bypass','Lalitpur','Thankot',18.70,32,'open','safe','Open; good condition.'),
  ('Hetauda Alternate (Lalitpur-Chitwan)','Lalitpur','Chitwan',152.00,230,'open','moderate','Longer alternate via Hetauda; no reported hazards.'),
  ('Far-East Hill Connector (Dhulikhel-Morang)','Dhulikhel','Morang',278.00,360,'open','moderate','Long route; passable.'),
  ('Eastern Nepal Link (Morang-Bhaktapur)','Morang','Bhaktapur',290.00,375,'high_risk','high','Intermittent minor flooding; usable by heavy vehicles.'),
  ('Koshi-Eastern Valley Connector','Koshi','Bhaktapur',295.00,380,'open','moderate','Open; moderate road quality.'),
  ('Koshi-Dhulikhel Link','Koshi','Dhulikhel',280.00,362,'open','safe','Clear route; recently inspected.'),
  ('Narayanghat-Chitwan to Lalitpur Express','Chitwan','Lalitpur',145.00,218,'open','safe','Fastest open route from Chitwan.'),
  ('Highway East (Bhaktapur-Morang)','Bhaktapur','Morang',285.00,368,'open','moderate','Open; standard condition.'),
  ('Chabahil-Lalitpur Inner Ring','Chabahil','Lalitpur',7.80,15,'open','safe','Urban road; all lanes open.')
) AS v(road_name, from_node, to_node, distance_km, base_minutes, state, risk, note)
WHERE NOT EXISTS (SELECT 1 FROM public.road_conditions LIMIT 1);

-- Disaster alerts
INSERT INTO public.disaster_alerts (title, category, area, severity, detail)
SELECT * FROM (VALUES
  ('Bagmati basin flood surge','flood','Kathmandu / Lalitpur','critical'::public.severity_level,'River level 1.8m above warning threshold. Evacuation advised for low-lying wards.'),
  ('Landslide activity - Malekhu','landslide','Dhading corridor','high','Two active slide zones on Prithvi Highway; intermittent closures.'),
  ('Bridge structural damage - Balkhu','bridge_damage','Kathmandu','critical','Bagmati bridge closed pending engineering assessment.'),
  ('Heavy rainfall warning','weather','Central & Eastern Nepal','high','120-180mm expected in next 24h. Expect new road closures.'),
  ('Koshi embankment watch','flood','Morang','moderate','Embankment seepage monitored; no breach reported.'),
  ('Dhulikhel corridor reopened','accessibility','Kavre','safe','Gravel bypass verified accessible for ambulances.')
) AS v(title, category, area, severity, detail)
WHERE NOT EXISTS (SELECT 1 FROM public.disaster_alerts LIMIT 1);

-- Emergency vehicles
INSERT INTO public.emergency_vehicles (code, kind, status, lat, lng, destination, eta_minutes, crew, home_base)
SELECT * FROM (VALUES
  ('AMB-101','ambulance','en_route'::public.vehicle_status,27.7020,85.3200,'Bir Hospital Trauma Centre',7,3,'Kathmandu'),
  ('AMB-104','ambulance','available',27.6700,85.3210,NULL,NULL,2,'Lalitpur'),
  ('AMB-207','ambulance','on_scene',27.6890,84.4310,'Narayanghat School Shelter',0,3,'Chitwan'),
  ('RES-311','rescue_truck','en_route',27.6220,85.5380,'Kavre Rescue Command Post',14,6,'Kavre'),
  ('FIRE-402','fire_engine','available',27.7080,85.3080,NULL,NULL,5,'Kathmandu'),
  ('BOAT-512','rescue_boat','on_scene',26.4790,87.2810,'Biratnagar Flood Camp',0,4,'Morang'),
  ('AMB-118','ambulance','returning',27.6740,85.4270,'Bhaktapur Community Hall',19,2,'Bhaktapur'),
  ('HELI-900','air_ambulance','offline',27.6960,85.3590,NULL,NULL,3,'Kathmandu')
) AS v(code, kind, status, lat, lng, destination, eta_minutes, crew, home_base)
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_vehicles LIMIT 1);

-- Emergency incidents
INSERT INTO public.emergency_incidents (reference, incident_type, location_name, lat, lng, severity, people_affected, road_accessible, required_service, status, ai_confidence, reports_fused, summary)
SELECT * FROM (VALUES
  ('RX-1042','road_accident','Kalanki junction, Kathmandu',27.6935,85.2810,'critical'::public.severity_level,3,true,'ambulance','in_progress'::public.incident_status,94,7,'Two vehicles appear to have collided. Three people may need assistance and traffic is partially blocked.'),
  ('RX-1057','flood_rescue','Balkhu riverside settlement',27.6845,85.3010,'critical',9,true,'rescue_team','assigned',89,12,'Rising water trapping residents on ground floors; boat support requested.'),
  ('RX-1063','landslide','Malekhu, Prithvi Highway',27.8100,84.8800,'high',6,false,'rescue_team','new',82,4,'Debris covering carriageway; vehicles reported stranded on both sides.'),
  ('RX-1071','medical_emergency','Bhaktapur Durbar area',27.6720,85.4280,'moderate',1,true,'ambulance','assigned',76,2,'Elderly patient reported with breathing difficulty.'),
  ('RX-1080','structure_collapse','Biratnagar ward 6',26.4780,87.2790,'high',4,true,'fire_response','in_progress',85,5,'Partial wall collapse after prolonged flooding.'),
  ('RX-1088','road_blockage','Sanga stretch, Araniko Highway',27.6400,85.4700,'moderate',0,false,'traffic_support','resolved',91,3,'Flood water blocking highway; bypass route published to field teams.')
) AS v(reference, incident_type, location_name, lat, lng, severity, people_affected, road_accessible, required_service, status, ai_confidence, reports_fused, summary)
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_incidents LIMIT 1);

-- Camera feeds
INSERT INTO public.camera_feeds (label, district, owner_kind, lat, lng, authorized, note)
SELECT * FROM (VALUES
  ('Riverside Bridge North Cam','Riverside','municipal',12.9721,77.5933,true,'Bridge deck and approach road'),
  ('Central Market Junction Cam','Central','municipal',12.9784,77.6042,true,'Crowd density at market square'),
  ('Hillview Society Gate Cam','Hillview','private',12.9502,77.5810,true,'Shared by residents association'),
  ('Eastgate Highway Toll Cam','Eastgate','highway',12.9899,77.6421,false,'Awaiting authority clearance'),
  ('Lakeside Relief Camp Cam','Lakeside','ngo',12.9410,77.6205,true,'Shelter intake queue')
) AS v(label, district, owner_kind, lat, lng, authorized, note)
WHERE NOT EXISTS (SELECT 1 FROM public.camera_feeds LIMIT 1);

-- ── STORAGE BUCKET NOTICE ─────────────────────────────────────────────────────
-- After running this SQL, also create the Storage bucket manually:
-- Supabase Dashboard → Storage → New bucket
--   Name: emergency-photos
--   Public: ON (so photo URLs are accessible)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'RESH MESQ schema applied successfully. All tables created.' AS status;
