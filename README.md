# RESH MESQ — Emergency Response & Disaster-Safe Route Optimizer

> **Intelligent emergency response platform** for disaster conditions.  
> Finds the safest usable route for ambulances and rescue teams during floods, landslides and road failures — scoring every corridor for hazard, then explaining the choice.

---

## Problem Statement

During disasters like floods and landslides, standard navigation apps offer the **shortest** route — not the **safest** one. Roads get flooded, bridges get damaged, and landslides block mountain highways. Emergency responders need a system that:

- Knows which roads are impassable right now
- Penalises risky roads (not just blocked ones)
- Recommends the safest *usable* alternative
- Explains exactly why each route was chosen or rejected

---

## Solution

**RESH MESQ** is a full-stack emergency command platform that:

1. Accepts SOS reports and incident submissions from the public
2. Maintains a live road-condition graph updated by responders
3. Runs a hazard-aware DFS routing algorithm over the graph
4. Recommends the safest corridor — not just the fastest
5. Connects missing-person reports, CCTV observations, and vehicle dispatch

---

## Key Features

| Feature | Description |
|---|---|
| **SOS Report** | Anyone can file an emergency report (anon or signed-in). Works offline — queued in localStorage, sent on reconnect. |
| **Incident Management** | Full CRUD for emergency incidents. Role-based status workflow: Reported → Response Assigned → In Progress → Resolved. |
| **Safe Route Planner** | DFS algorithm scores every road corridor. Blocked roads removed. High-risk roads penalised. Explains why each route was chosen. |
| **Evacuation Corridors** | Find top-3 safest evacuation routes from a node to all reachable destinations. Real Leaflet map with OpenStreetMap tiles. |
| **Missing Person** | Report missing persons with optional photo upload to Supabase Storage. Auto-generates Case ID. |
| **Community Map** | Drop pins on a real Leaflet map to mark where help is needed. Realtime via Supabase Realtime. |
| **CCTV Intelligence** | Scenario camera observations linked to road segments → route impact chain visualised. |
| **Alert Centre** | Disaster alerts in English and Nepali with severity classification. |
| **Analytics** | Live charts from Supabase data — incidents, vehicles, road conditions, response trends. |
| **Accessibility** | Voice guidance (Speech Synthesis API), high contrast, text scaling, keyboard navigation, Nepali language support. |
| **Offline SOS** | SOS reports queued in localStorage when offline, auto-sent on reconnect. |

---

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Maps**: Leaflet + react-leaflet + OpenStreetMap
- **Charts**: Recharts
- **Deployment**: Vercel (TanStack Start / Nitro SSR)

---

## Architecture Overview

```
Browser (React SPA + SSR)
    ↓ TanStack Query hooks
Supabase Client (anon / authenticated JWT)
    ↓ Row-Level Security
PostgreSQL (9 tables, 5 enums)
    + Supabase Auth (JWT sessions)
    + Supabase Storage (emergency-photos bucket)
    + Supabase Realtime (community map pins)
```

**Routing Algorithm** — client-side DFS over `road_conditions` rows:
- `blocked` / `bridge_damaged` / `flooded` / `landslide` roads get cost 9999 (effectively impassable for standard vehicles)
- `high_risk` roads get a 1.4× time multiplier
- Rescue boats / air ambulances can traverse flooded/damaged roads
- Returns up to 2 distinct paths sorted by total cost

---

## Database & Backend

### Tables

| Table | Purpose |
|---|---|
| `emergency_incidents` | All incidents — SOS reports, manual entries |
| `emergency_vehicles` | Fleet with status, location, crew |
| `road_conditions` | Road network with hazard state |
| `disaster_alerts` | Active disaster warnings |
| `hospitals` | Hospital locations and bed availability |
| `shelters` | Evacuation shelter capacity |
| `missing_persons` | Missing-person cases with privacy controls |
| `family_contacts` | User's trusted contacts |
| `camera_feeds` | Authorised camera metadata |
| `routes` | Saved route calculations |

### RLS Policies (key rules)

- **Incidents**: Public can read. Authenticated users can insert (with their user id). Anon users can insert SOS reports (created_by must be NULL).
- **Missing persons**: Anyone can INSERT. Only authenticated users can SELECT. Only admin/dispatcher/responder can UPDATE status.
- **Vehicles, roads, alerts**: Public read. Staff write.

---

## Accessibility Features

- **Voice guidance** — Speech Synthesis API reads alerts, routes, and status changes
- **Voice input** — Web Speech API dictation on SOS/missing-person forms
- **High contrast mode** — WCAG-compliant color overrides
- **Text scaling** — Normal / Large / Largest
- **Screen reader** — ARIA labels and `role="img"` on all SVG maps; text fallbacks under `<details>`
- **Keyboard navigation** — Full tab + Enter flow
- **Nepali language** — Alert text + voice output in English and Nepali

---

## How to Run Locally

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)
- A Supabase project with the schema applied

### 1. Clone and install

```sh
git clone https://github.com/kalyaniavni06-prog/resh-mesq.git
cd resh-mesq
npm install
```

### 2. Set environment variables

Copy `.env.example` to `.env` (or set directly):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-ref
```

> ⚠️ **Never commit secrets.** Service role key is server-only.

### 3. Apply database migrations

In the **Supabase dashboard → SQL Editor**, run each migration in order:

1. `drizzle/migrations/0000_create_resh_mesq_core.sql`
2. `drizzle/migrations/0001_family_contacts_cameras_public_sos.sql`
3. `drizzle/migrations/0002_missing_persons.sql`
4. `drizzle/migrations/0003_additional_open_roads.sql` ← **required for routing to work**

### 4. Create Storage bucket

In **Supabase dashboard → Storage**, create a bucket named `emergency-photos` (public access ON).

### 5. Start the dev server

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (build-time baked into client bundle) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase publishable/anon key (build-time) |
| `SUPABASE_URL` | ✅ | Same URL for SSR runtime |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | Same key for SSR runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations — never expose to client |

---

## Deployment (Vercel)

1. Connect repository in Vercel dashboard
2. Set all environment variables (`VITE_*` + non-`VITE_*`) in Project Settings → Environment Variables
3. Build command: `npm run build:vercel`
4. Framework preset: **TanStack Start**

> ⚠️ Both `VITE_SUPABASE_URL` and `SUPABASE_URL` must be set in Vercel. The `VITE_` prefix is baked into the client bundle at build time; the non-prefixed version is used by the SSR server at runtime.

---

## Scenario / Demo Data

RESH MESQ ships with **seeded scenario data** pre-loaded in the database to demonstrate the platform during presentations when there are no real incidents:

- 6 emergency incidents (Bihar/Nepal flood scenario)
- 5 hospitals, 5 shelters
- 8 emergency vehicles
- 10+ road segments (some blocked, some open — realistic hazard mix)
- 6 disaster alerts
- 8 CCTV camera observations (scenario only, not real feeds)

**Separate from real user data:**
- "Scenario mode" toggle in Incident Management shows seeded incidents alongside real ones
- Normal mode shows only user-submitted incidents
- Scenario incidents are clearly labelled with a "Scenario" chip and cannot be edited

---

## Team

Built for emergency response research and hackathon demonstration.  
Not for real emergency dispatch.

**For real emergencies — call 112 (Nepal) or your local emergency number.**

---

## Screenshots

*(Add screenshots of Command Centre, Route Planner, SOS form, Missing Person report, and Community Map here)*

---

*Built with [Lovable](https://lovable.dev) · Deployed on Vercel · Database on Supabase*
