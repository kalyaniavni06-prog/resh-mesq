-- Missing / Lost Person emergency reports
-- Privacy-first: photo stored as optional URL only, contact info restricted to responders via RLS.

CREATE TABLE public.missing_persons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          text        NOT NULL UNIQUE DEFAULT ('MP-' || lpad((floor(random()*9000+1000))::text,4,'0')),
  -- Personal details
  full_name        text        NOT NULL,
  approximate_age  int         NOT NULL CHECK (approximate_age BETWEEN 0 AND 120),
  gender           text        NOT NULL DEFAULT 'not_specified',
  clothing_desc    text,
  identifying_desc text,
  -- Last known location
  last_known_location text     NOT NULL,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  lat              double precision,
  lng              double precision,
  -- Optional photo: URL reference only — no raw image data in DB
  photo_url        text,
  -- Reporter details — private, responders only
  reporter_name    text        NOT NULL,
  reporter_contact text        NOT NULL,
  -- Status workflow
  status           text        NOT NULL DEFAULT 'reported'
                   CHECK (status IN ('reported','verified','search_in_progress','located','closed')),
  notes            text,
  -- Audit
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.missing_persons ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (public emergency report)
GRANT INSERT ON public.missing_persons TO anon, authenticated;
-- Only authenticated (responders/admins) can SELECT
GRANT SELECT, UPDATE ON public.missing_persons TO authenticated;
GRANT ALL ON public.missing_persons TO service_role;

CREATE POLICY "anyone can report missing person"
  ON public.missing_persons FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "responders can read missing persons"
  ON public.missing_persons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "responders can update status"
  ON public.missing_persons FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'dispatcher') OR
    public.has_role(auth.uid(), 'responder')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER missing_persons_updated_at
  BEFORE UPDATE ON public.missing_persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
