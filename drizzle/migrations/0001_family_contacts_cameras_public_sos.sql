-- Allow the public to file an emergency report (SOS) without an account.
CREATE POLICY "incidents insert anon sos"
  ON public.emergency_incidents FOR INSERT TO anon
  WITH CHECK (created_by IS NULL);
GRANT INSERT ON public.emergency_incidents TO anon;

-- Let a signed-in user claim their own role at sign-up.
CREATE POLICY "insert own role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
GRANT INSERT ON public.user_roles TO authenticated;

-- Family contacts notified when a user raises an SOS.
CREATE TABLE public.family_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  relation text NOT NULL DEFAULT 'family',
  phone text NOT NULL,
  notify_by_sms boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_contacts TO authenticated;
GRANT ALL ON public.family_contacts TO service_role;
ALTER TABLE public.family_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family contacts" ON public.family_contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Authorized camera feeds that responders may consult during an incident.
CREATE TABLE public.camera_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  district text NOT NULL,
  owner_kind text NOT NULL DEFAULT 'public',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  authorized boolean NOT NULL DEFAULT false,
  last_frame_at timestamptz NOT NULL DEFAULT now(),
  note text
);
GRANT SELECT ON public.camera_feeds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camera_feeds TO authenticated;
GRANT ALL ON public.camera_feeds TO service_role;
ALTER TABLE public.camera_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cameras public read" ON public.camera_feeds
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cameras staff write" ON public.camera_feeds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

INSERT INTO public.camera_feeds (label, district, owner_kind, lat, lng, authorized, note) VALUES
  ('Riverside Bridge North Cam', 'Riverside', 'municipal', 12.9721, 77.5933, true, 'Bridge deck and approach road'),
  ('Central Market Junction Cam', 'Central', 'municipal', 12.9784, 77.6042, true, 'Crowd density at market square'),
  ('Hillview Society Gate Cam', 'Hillview', 'private', 12.9502, 77.5810, true, 'Shared by residents association'),
  ('Eastgate Highway Toll Cam', 'Eastgate', 'highway', 12.9899, 77.6421, false, 'Awaiting authority clearance'),
  ('Lakeside Relief Camp Cam', 'Lakeside', 'ngo', 12.9410, 77.6205, true, 'Shelter intake queue');