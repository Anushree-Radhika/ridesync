<div align="center">

# 🚗 RideSync

### Share the road. Split the fare. Clear the air.

RideSync was built from a simple observation — cities are choking, rides are getting more expensive, and drivers are earning less per hour, all at the same time. Every person taking a separate cab to the same destination is not just wasteful. It is the default the entire industry is built around.

RideSync is built around the opposite idea.

[![Status](https://img.shields.io/badge/status-MVP%20in%20progress-orange)](https://github.com/Anushree-Radhika/ridesync)
[![Stack](https://img.shields.io/badge/stack-100%25%20free%20%26%20open%20source-brightgreen)](https://github.com/Anushree-Radhika/ridesync)
[![License](https://img.shields.io/badge/license-ISC-blue)](#license)
[![Built for](https://img.shields.io/badge/built%20for-the%20world%20🌍-blueviolet)](https://github.com/Anushree-Radhika/ridesync)

</div>

---

## 📖 Table of Contents

- [Why RideSync Exists](#-why-ridesync-exists)
- [How It Works](#-how-it-works)
- [The Booking Flow](#-the-booking-flow)
- [The ML Matching Engine](#-the-ml-matching-engine)
- [Vehicle Capacity System](#-vehicle-capacity-system)
- [Fare Split Logic](#-fare-split-logic)
- [Safety by Design](#-safety-by-design)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [MVP Scope](#-mvp-scope)
- [Roadmap](#-roadmap)
- [Codebase Bible](#-codebase-bible--for-team-members)

---

## 🌍 Why RideSync Exists

Three things are happening simultaneously on every street in every growing city in the world.

**Pollution is rising.** Road transport is one of the largest contributors to urban air pollution. Every additional vehicle on the road — burning fuel to carry one person who could have shared with two others — makes it worse. Fewer cars carrying more people means less emissions. No platform is built to make that happen at scale.

**Ride prices keep climbing.** Surge pricing, fuel costs, platform commissions — the rider absorbs all of it. A solo booking means one person carrying the full fare, every time.

**Drivers are earning less per hour.** Between rides they reposition, wait, run empty. A driver completing one well-matched group trip across overlapping routes earns more per hour than three separate solo rides with dead time between them — because the dead time disappears.

The driver gets paid more. The rider pays less per head. The car that was already going makes better use of the road it occupies.

RideSync is the coordination layer that makes this possible. It uses machine learning to find people near you heading the same direction at the same time, checks that everyone fits comfortably in a single vehicle, and splits the fare based on exactly how much of the route each person actually uses.

Same destination. Fraction of the cost. One car instead of three.

---

## 💡 How It Works

A user lands on RideSync and enters four things:

- Where they are being picked up
- Where they are going
- How many people are in their group and their group's gender composition
- How many non-hand-luggage items they are carrying

That is all. The system takes it from there.

Based on this input, the system knows which vehicles can physically fit the group and luggage. It presents the user with two options — **Solo** or **Carpool** — and shows only vehicles that are actually viable for their specific group. No hatchback shown to a group of 3 carrying 2 trolleys. No bike shown to a group of 2.

If the user chooses Carpool, the matching engine runs. It looks at every other active carpool request nearby, checks route overlap, timing, vehicle fit, luggage fit, and the one gender safety rule. Compatible riders are grouped. Everyone sees each other's destination before confirming. Only then is a driver found.

---

## 📱 The Booking Flow

### Step 1 — Enter trip details

```
📍  Pickup location
🏁  Destination
👥  Number of passengers in your group
⚧   Group gender          [ Male only ]  [ Female only ]  [ Mixed ]
🧳  Non-hand luggage       [ 0 ]  [ 1 ]  [ 2 ]  [ 3+ ]
```

This gets saved to the database immediately. Everything that follows is derived from this.

---

### Step 2 — Solo or Carpool?

The system evaluates the input and shows both options:

```
How do you want to travel?

🚗  Solo      Your vehicle. Full price. Leave now.
🔄  Carpool   Share with compatible riders nearby. Split the fare.
```

---

### Step 3 — Choose your vehicle

Based on the group size and luggage entered, the system shows only vehicles that can comfortably fit the group. Vehicles that cannot fit are not shown at all.

```
Available for your group:

🛺  Toto / Auto       ← more available nearby
🚗  Sedan             ← more available nearby
🚕  SUV
🚐  Van
```

A quiet signal — "more available nearby" — helps the user make a faster decision without overwhelming them with numbers. The choice is always theirs.

Bikes are solo only and never appear in carpool. Totos with large luggage groups are filtered out silently before this screen.

---

### Step 4 — Matching window (Carpool only)

The request enters the matching pool. The ML engine runs. Compatible nearby riders are evaluated. This takes up to 3 minutes.

---

### Step 5 — Confirm your group

Every matched rider sees this screen at the same time:

```
Your match

👤  Priya S.   ⭐ 4.8     Destination: Koramangala 5th Block
👤  Rahul M.   ⭐ 4.6     Destination: HSR Layout

Vehicle:  Sedan  ·  4 seats  ·  boot fits your luggage ✓

Your fare share:   ₹ 67     (vs ₹ 180 solo)

[ Confirm — 54s ]     [ Decline ]
```

Everyone has 60 seconds. All must confirm. If anyone declines, the group dissolves and each rider is offered the next best match or a solo ride.

---

### Step 6 — Ride happens

Driver accepted. Ride locked. Live map. Driver moves toward the group in real time. Optimised pickup order. Everyone sees the same map.

---

### Step 7 — Ride complete

Fare split proportionally by actual route. Wallet charged. Ratings open.

---

## 🤖 The ML Matching Engine

### The core problem it solves

Given a pool of active carpool requests in an area, find the optimal groupings where:
- The combined group fits in one real vehicle (seats + boot space)
- Routes overlap meaningfully
- Departure times are close
- The one gender safety rule is respected
- Everyone in the combined group is comfortable

### What gets stored when a user submits their request

```json
{
  "pickup_lat": 12.9716,
  "pickup_lng": 77.5946,
  "drop_lat": 12.9352,
  "drop_lng": 77.6245,
  "requested_at": "2024-01-15T08:32:00Z",
  "group_size": 3,
  "group_gender": "MIXED",
  "non_hand_luggage": 2,
  "preferred_vehicle": "SEDAN"
}
```

### The matching pipeline — step by step

**Step 1 — Spatial pre-filter**

Redis `GEORADIUS` eliminates every request outside the pickup radius instantly. Pure geography. No model needed. This runs first because it is the cheapest filter.

**Step 2 — Vehicle capacity gate**

For every candidate pair or group, the system checks whether the **combined** group fits in a single vehicle:

```
Combined group check:

  Total passengers  =  groupA.size  +  groupB.size
  Total luggage     =  groupA.luggage  +  groupB.luggage

  Does any available vehicle fit both?
    seats available  >=  total passengers   →  pass
    boot space       >=  total luggage      →  pass

  No vehicle fits  →  eliminated
```

This is the key insight. Two groups are not evaluated individually — they are evaluated as the combined unit they would become. Three people with two trolleys plus one person with no luggage equals four people and two trolleys — a sedan fits this comfortably. The system knows this before DBSCAN ever runs.

**Step 3 — Gender safety gate**

One rule. One check. Hard elimination if it fails:

```
if groupA.gender == MALE_ONLY and groupB.gender == FEMALE_ONLY  →  blocked
if groupA.gender == FEMALE_ONLY and groupB.gender == MALE_ONLY  →  blocked

All other combinations  →  allowed:
  MALE_ONLY    +  MALE_ONLY    ✅
  FEMALE_ONLY  +  FEMALE_ONLY  ✅
  MIXED        +  MIXED        ✅
  MALE_ONLY    +  MIXED        ✅
  FEMALE_ONLY  +  MIXED        ✅
```

A mixed group already contains both genders. Adding a male-only or female-only group to a mixed group does not create a new safety concern — the dynamic already exists in the vehicle. The only combination that creates a genuine risk is a group of only women being placed with a group of only men who are strangers. That one combination is permanently blocked.

**Step 4 — Route overlap scoring**

For every candidate pair that passed the gates, the system calculates a route overlap score using the Haversine formula on pickup and drop coordinates. High overlap scores high. Diverging routes score zero and are eliminated.

**Step 5 — Time proximity scoring**

Preferred departure times are compared. Riders more than 8 minutes apart receive a penalty score. Beyond 15 minutes, excluded from the same group.

**Step 6 — DBSCAN clustering**

The surviving candidates are fed into DBSCAN. The algorithm finds natural clusters from data density without needing a predefined number of groups. Riders who do not fit any cluster cleanly are treated as noise — they are offered a solo ride, not forced into a poor match.

The cluster size ceiling is not hardcoded. It is the available seat count of the matched driver's vehicle, pulled from their RC-verified registration at match time.

**Step 7 — Group scoring**

```
Group Score =  (route_overlap_weight   ×  route_overlap_%)
            +  (time_proximity_weight  ×  time_score)
            -  (detour_penalty         ×  extra_km_for_driver)
            +  (comfort_bonus          ×  seat_and_boot_fit_margin)
```

Highest scoring valid group is sent to riders for confirmation.

### Worked example

```
Request A:  3 people  ·  2 trolleys  ·  Mixed  ·  going to Airport
Request B:  1 person  ·  0 luggage   ·  Male   ·  going near Airport

Step 1 — Spatial:     both within radius            ✅
Step 2 — Vehicle:     4 people + 2 trolleys
                      Sedan: 4 seats ✅  boot fits 2 trolleys ✅
Step 3 — Gender:      MIXED + MALE_ONLY             ✅  (not the blocked pair)
Step 4 — Route:       both going to Airport area    high overlap ✅
Step 5 — Time:        requested 4 minutes apart     ✅

→  DBSCAN clusters them
→  One sedan  ·  4 people  ·  2 trolleys in boot
→  Fare split: A's group pays their route share, B pays theirs
```

---

## 🚗 Vehicle Capacity System

The system knows vehicle constraints as fixed platform knowledge — not self-declared by drivers.

| Vehicle | Max passengers | Boot space | Pool eligible | Notes |
|---|---|---|---|---|
| 🏍️ Bike | 1 | None | ❌ Solo only | Never appears in carpool flow |
| 🛺 Toto / Auto | 3 | Minimal | ⚠️ Limited | Filtered out if luggage > small bags |
| 🚗 Hatchback | 4 | Small | ✅ | Light luggage groups only |
| 🚙 Sedan | 4 | Medium | ✅ | Best default for most carpool trips |
| 🚕 SUV / Bigger car | 6 | Large | ✅ | Larger groups, heavy luggage |
| 🚐 Van | 7+ | Extra large | ✅ | Maximum capacity |

Boot space is tracked as a running total per group as riders are added. Two groups each carrying large trolleys are checked against the combined boot requirement — not individually.

Driver vehicle type and seating capacity are verified from their RC document during KYC onboarding. Riders see a verified vehicle, not a self-declared one.

---

## 💰 Fare Split Logic

### Base fare

```
Base Fare  =  (distance in km  ×  per-km rate)  +  base booking fee
```

### Proportional split

Each rider pays for the exact portion of the route they use.

```
Example:

Rider A  →  boards at Point 1, exits at Point 3
Rider B  →  boards at Point 1, exits at Point 4
Rider C  →  boards at Point 2, exits at Point 4

Total route: 20km

Segment 1→2  (5km):  A and B share      each pays  5/2  =  2.5km
Segment 2→3  (8km):  A, B, C share      each pays  8/3  =  2.67km
Segment 3→4  (7km):  B and C share      each pays  7/2  =  3.5km

Rider A:  2.5 + 2.67                =  5.17km equivalent
Rider B:  2.5 + 2.67 + 3.5         =  8.67km equivalent
Rider C:  2.67 + 3.5               =  6.17km equivalent

Each fare  =  (rider km equivalent / total route km)  ×  Base Fare
```

Every rider sees their exact share and the breakdown before confirming. No surprises after the ride.

---

## 🛡️ Safety by Design

Safety in RideSync is not a settings menu. It is built into the matching algorithm itself.

### The gender safety rule

The only blocked combination is a male-only group matched with a female-only group. Every other combination is permitted because mixed groups already contain both genders — the dynamic is not new.

This rule runs at Step 3 of the matching pipeline. It is a hard gate. There is no override. There is no toggle. A female-only group will never be placed in a vehicle with a male-only group of strangers, under any circumstances.

### Verified vehicles

Every driver's vehicle type and seating capacity is pulled from their RC document during KYC. When a rider sees a sedan is coming, it is a verified sedan — not a self-declared one.

### Destination transparency

Every matched rider sees the destination area of their co-riders before confirming. Nobody is committed to a ride until they have seen who they are riding with and where everyone is going.

### Mutual ratings

Every ride ends with all parties rating each other. Consistently low-rated users affect the group score negatively in future matches — they are deprioritised before they affect others.

### Atomic ride locking

The moment a driver accepts, the ride is locked in the system using an atomic Redis operation. No two drivers can claim the same ride. No double-booking is possible.

---

## 🏗️ System Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                              RIDESYNC PLATFORM                               ║
╠═════════════════════╦════════════════════════╦════════════════════════════════╣
║                     ║                        ║                               ║
║  NEXT.JS FRONTEND   ║  NODE.JS + EXPRESS     ║  ML MATCHING ENGINE           ║
║  Web → Mobile       ║  REST API + Socket.io  ║                               ║
║                     ║                        ║                               ║
║  • Trip input form  ║  • Auth & JWT          ║  Step 1: Spatial pre-filter   ║
║  • Solo / carpool   ║  • Ride lifecycle      ║  Step 2: Vehicle capacity gate ║
║  • Vehicle picker   ║  • Fare calculation    ║  Step 3: Gender safety gate   ║
║  • Match confirm    ║  • Socket events       ║  Step 4: Route overlap score  ║
║  • Live map         ║  • Driver KYC          ║  Step 5: Time proximity score ║
║  • Fare breakdown   ║  • Wallet management   ║  Step 6: DBSCAN clustering    ║
║  • Ratings          ║  • Notifications       ║  Step 7: Group scoring        ║
║                     ║                        ║                               ║
╠═════════════════════╩══════════╦═════════════╩═══════════════════════════════╣
║                                ║                                             ║
║        UPSTASH REDIS           ║          SUPABASE POSTGRESQL                ║
║        Real-time layer         ║          Permanent record store             ║
║                                ║                                             ║
║  • Driver GPS  (GEOADD)        ║  • All users — riders and drivers           ║
║  • GEORADIUS spatial queries   ║  • All rides and full status history        ║
║  • Active matching pool (TTL)  ║  • Vehicle capacity and boot space          ║
║  • Ride locks  (SET NX)        ║  • RC-verified driver KYC documents         ║
║  • OTP cache  (5 min TTL)      ║  • Wallet and transaction history           ║
║  • DBSCAN candidate buffer     ║  • Ratings and match acceptance history     ║
║                                ║  • Refresh tokens and notifications         ║
╠════════════════════════════════╩═════════════════════════════════════════════╣
║                                                                              ║
║  OPEN SOURCE MAPS                                                            ║
║  Leaflet.js + OpenStreetMap  →  map rendering, zero cost, no API key        ║
║  OSRM                        →  road routing, actual distance calculation    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Carpool request data flow

```
User submits trip input (source, destination, group size, gender, luggage)
                    │
                    └──  Saved to PostgreSQL + Redis matching pool (TTL: 3 min)
                                        │
                         ML ENGINE runs every 30 seconds
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
             Spatial filter     Vehicle capacity     Gender safety
             GEORADIUS          gate (combined        gate (one rule)
                    │           group check)                │
                    └───────────────────┼───────────────────┘
                                        │
                               Route overlap score
                               Time proximity score
                                        │
                                  DBSCAN clusters
                              (ceiling = driver seats)
                                        │
                                  Group scoring
                                        │
                         All riders see match card simultaneously
                         (co-rider name, rating, destination, fare share)
                                        │
                              60 seconds to confirm
                                        │
                              All confirm  ──────────────────────►
                                        │
                              Driver found → notified via Socket.io
                              Driver accepts → Redis SET NX locks ride
                              PostgreSQL saves record permanently
                                        │
                              Live map begins for all riders
                              Optimised pickup order calculated
                                        │
                              Ride completes
                              Proportional fare split
                              Wallet charged per rider
                              Ratings open
```

---

## 📦 Tech Stack

100% free and open source. No paid APIs. No usage costs during MVP.

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js | Web first, React Native for mobile later |
| Backend | Node.js + Express + TypeScript | Type-safe, fast, well-documented |
| Real-time | Socket.io | Live GPS updates, instant match notifications |
| ML Engine | DBSCAN (custom Node.js implementation) | Runs inside backend, no separate ML server needed for MVP |
| Maps | Leaflet.js + OpenStreetMap | Fully free, no API key, no usage limits |
| Routing | OSRM | Free road routing and real distance calculation |
| Cache | Upstash Redis (free tier) | Live GPS, matching pool, ride locks, OTP |
| Database | Supabase PostgreSQL + Prisma (free tier) | All permanent records |
| Auth | JWT + Refresh tokens + Phone OTP | Stateless, secure, no third-party auth cost |
| Backend hosting | Render (free tier) | Auto-deploys from GitHub |
| Frontend hosting | Vercel (free tier) | Auto-deploys from GitHub |
| Payments | Deferred to V2 | Validate matching first. Razorpay wires in after real users confirm the core works. |

---

## 🎯 MVP Scope

The MVP proves exactly three things. If any one fails, the product fails.

**1. The matching works**
Right people, right route, right vehicle. The combined group fits the vehicle — seats and boot space both. The gender safety rule is never violated. Nobody is forced into a poor match. This is the core. It must be correct.

**2. The fare split is transparent**
Every rider sees their exact share and the calculation before confirming. After the ride, the wallet deduction matches what was shown. Zero surprises.

**3. Live tracking works**
Once a driver accepts, the map is live. The driver's pin moves in real time. Riders know exactly where the driver is throughout the trip.

### What is not in the MVP

| Feature | Why deferred |
|---|---|
| Payments (Razorpay) | Validate matching first. Wallet logic built; gateway wires in V2. |
| Mobile app | Web first. Validate before native build. |
| Supervised ML model | DBSCAN ships first. V2 model needs real match data to train on. |
| Scheduled / advance booking | Real-time matching first. |
| In-app chat | Destination preview and ratings sufficient for MVP trust. |
| Surge pricing | Flat dynamic rate for MVP. |
| Driver earnings dashboard | Core ride flow first. |

---

## 🗺️ Roadmap

```
✅ Phase 1    Infrastructure — PostgreSQL, Redis, Prisma, scaffold
✅ Phase 2    Auth — OTP, JWT, refresh tokens, registration
✅ Phase 3    Ride engine — solo request, match, track, complete
⬜ Phase 4    Trip input — group size, gender, luggage capture + DB save
⬜ Phase 5    Vehicle system — capacity rules, boot space, RC KYC
⬜ Phase 6    ML matching engine — all 7 pipeline steps
⬜ Phase 7    Match confirmation UI — co-rider preview, fare breakdown, 60s window
⬜ Phase 8    Fare split logic — proportional calculation, wallet integration
⬜ Phase 9    Production deploy — Render + Vercel
⬜ Phase 10   Beta launch 🚀
⬜ Phase 11   Razorpay payments
⬜ Phase 12   V2 ML — supervised model on real acceptance data
⬜ Phase 13   React Native mobile app
⬜ Phase 14   Scale — global rollout
```

---

## 📚 Codebase Bible — For Team Members

> **For RideSync engineers only.** All engineers connect to the shared dev database. Do not create your own Supabase or Upstash instances. Get the `.env` from the team lead directly.

### Getting running

```bash
git clone https://github.com/Anushree-Radhika/ridesync.git
cd ridesync/backend
npm install

# Get .env from team lead — do not create your own DB instances
npx prisma generate

npm run dev
# → http://localhost:5000

curl http://localhost:5000/health
```

### Project structure

```
ridesync/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts                      ← Prisma client singleton
│   │   │   ├── redis.ts                   ← Upstash Redis connection
│   │   │   └── socket.ts                  ← Socket.io server setup
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── ride.controller.ts
│   │   │   └── vehicle.controller.ts
│   │   ├── matching/
│   │   │   ├── spatialFilter.ts           ← Step 1: Redis GEORADIUS
│   │   │   ├── vehicleCapacityGate.ts     ← Step 2: combined seats + boot check
│   │   │   ├── genderSafetyGate.ts        ← Step 3: male-only + female-only block
│   │   │   ├── routeScore.ts              ← Step 4: Haversine overlap scoring
│   │   │   ├── timeScore.ts               ← Step 5: departure time proximity
│   │   │   ├── dbscan.ts                  ← Step 6: DBSCAN clustering
│   │   │   ├── groupScore.ts              ← Step 7: composite group scoring
│   │   │   └── matchingJob.ts             ← background job, runs every 30s
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   └── ride.routes.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── ride.service.ts
│   │   │   ├── matching.service.ts        ← orchestrates full pipeline
│   │   │   └── vehicle.service.ts         ← capacity rules, boot space logic
│   │   ├── sockets/
│   │   │   └── ride.socket.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── fare.ts                    ← proportional split — only place
│   │   │   ├── osrm.ts                    ← OSRM routing wrapper — only place
│   │   │   ├── jwt.ts
│   │   │   └── response.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── src/                                   ← Next.js frontend
    └── app/
```

### Data model

```
User
├── RiderProfile
│   ├── group_size           ← entered at booking
│   ├── group_gender         ← MALE_ONLY / FEMALE_ONLY / MIXED
│   └── non_hand_luggage     ← count of large items
├── DriverProfile
│   └── Vehicle
│       ├── type             ← Bike/Toto/Hatchback/Sedan/SUV/Van
│       ├── seat_capacity    ← from RC document
│       └── boot_space       ← None/Minimal/Small/Medium/Large/XL
├── Wallet
│   └── WalletTransaction
├── Ride
│   ├── RideRider[]          ← one entry per rider group in the vehicle
│   │   ├── group_size
│   │   ├── non_hand_luggage
│   │   └── fare_share       ← proportional amount charged
│   ├── Payment[]
│   ├── Rating[]
│   └── RideStatusHistory
├── MatchingPool             ← active requests awaiting match
├── Notification
├── OtpVerification
└── RefreshToken
```

### Key engineering rules

- The matching engine runs as a background job every 30 seconds via `matchingJob.ts`. It is not triggered per request.
- Vehicle capacity gate checks the **combined** group, not individual riders. See `vehicleCapacityGate.ts`.
- Gender safety gate is one condition: `MALE_ONLY + FEMALE_ONLY = blocked`. See `genderSafetyGate.ts`. No other logic lives here.
- Cluster size ceiling is the driver's available seat count from their vehicle record. It is never hardcoded.
- Ride locks use Redis `SET NX` — atomic. No race conditions. No double bookings.
- GPS writes go to Redis only. PostgreSQL gets the route summary after completion, never individual pings.
- All fare logic lives only in `utils/fare.ts`. Nowhere else.
- All OSRM calls go through `utils/osrm.ts`. Never call OSRM directly from a controller or service.
- `matching/` is one file per pipeline step. Keep it that way. Each step is independently testable.

---

## 📄 License

ISC © RideSync

---

<div align="center">

Three people. One car. One fare split three ways. One less vehicle on the road.

Built with ❤️ in India 🇮🇳 &nbsp;|&nbsp; Radhe Radhe 🙏

[github.com/Anushree-Radhika/ridesync](https://github.com/Anushree-Radhika/ridesync)

</div>
