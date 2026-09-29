-- Additional road segments ensuring the network is connected enough
-- for the DFS route planner to find valid paths between all major nodes.
--
-- Hazards remain on the primary routes (existing seeds).
-- These segments represent alternate corridors, bypass roads, and
-- secondary routes that are currently open/passable.
--
-- Scenario: Bihar/Nepal flood conditions — several primary roads blocked,
-- but alternate routes remain usable.

INSERT INTO public.road_conditions
  (road_name, from_node, to_node, distance_km, base_minutes, state, risk, note)
VALUES
  -- Lalitpur ↔ Bhaktapur (city ring, open)
  ('Bhaktapur–Lalitpur Link Road', 'Lalitpur', 'Bhaktapur', 11.50, 22, 'open', 'safe',
   'Open; minor waterlogging at underpasses cleared.'),

  -- Bhaktapur ↔ Dhulikhel (hill road, passable with caution)
  ('Arniko Alternate – Bhaktapur to Dhulikhel', 'Bhaktapur', 'Dhulikhel', 19.80, 36, 'high_risk', 'high',
   'Narrow hill road; passable for ambulances, avoid during heavy rain.'),

  -- Chabahil ↔ Bhaktapur (Ring Road east spur, open)
  ('Ring Road East Spur', 'Chabahil', 'Bhaktapur', 10.20, 19, 'open', 'safe',
   'All lanes open; normal traffic.'),

  -- Kathmandu ↔ Chabahil already exists (Ring Road North); add Chabahil ↔ Dhulikhel
  ('Chabahil–Dhulikhel Outer Road', 'Chabahil', 'Dhulikhel', 22.40, 38, 'open', 'moderate',
   'Open; some sections narrow. Passable for all emergency vehicles.'),

  -- Lalitpur ↔ Thankot (southern bypass, open)
  ('Lalitpur–Thankot Southern Bypass', 'Lalitpur', 'Thankot', 18.70, 32, 'open', 'safe',
   'Open; good condition after repair crew visit.'),

  -- Thankot ↔ Chitwan already has Chandragiri Link; add direct Lalitpur → Chitwan via Hetauda
  ('Hetauda Alternate (Lalitpur–Chitwan)', 'Lalitpur', 'Chitwan', 152.00, 230, 'open', 'moderate',
   'Longer alternate via Hetauda; no reported hazards.'),

  -- Dhulikhel ↔ Morang (Far-East Highway via hills)
  ('Far-East Hill Connector (Dhulikhel–Morang)', 'Dhulikhel', 'Morang', 278.00, 360, 'open', 'moderate',
   'Long route; passable, no current closures reported.'),

  -- Morang ↔ Bhaktapur  (cross-country link, open)
  ('Eastern Nepal Link (Morang–Bhaktapur)', 'Morang', 'Bhaktapur', 290.00, 375, 'high_risk', 'high',
   'Intermittent minor flooding; usable by heavy vehicles.'),

  -- Koshi ↔ Bhaktapur  (ensures Koshi is reachable)
  ('Koshi–Eastern Valley Connector', 'Koshi', 'Bhaktapur', 295.00, 380, 'open', 'moderate',
   'Open; moderate road quality.'),

  -- Koshi ↔ Dhulikhel
  ('Koshi–Dhulikhel Link', 'Koshi', 'Dhulikhel', 280.00, 362, 'open', 'safe',
   'Clear route; recently inspected.'),

  -- Chitwan ↔ Lalitpur (direct, confirmed open alternative)
  ('Narayanghat–Chitwan to Lalitpur Express', 'Chitwan', 'Lalitpur', 145.00, 218, 'open', 'safe',
   'Fastest currently-open Kathmandu valley route from Chitwan.'),

  -- Bhaktapur ↔ Morang direct (highway east)
  ('Highway East (Bhaktapur–Morang)', 'Bhaktapur', 'Morang', 285.00, 368, 'open', 'moderate',
   'Open; standard condition.'),

  -- Chabahil ↔ Lalitpur (inner ring)
  ('Chabahil–Lalitpur Inner Ring', 'Chabahil', 'Lalitpur', 7.80, 15, 'open', 'safe',
   'Urban road; all lanes open.')
;
