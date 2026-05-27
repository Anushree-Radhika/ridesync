# 🚗 RideSync

>Reimagining mobility through intelligent ride matching.

>RideSync is a full-stack, cross-platform carpooling and ride-sharing solution tailored for high-density zones in India (like airports, railway stations, tech parks, and stadiums). While traditional ride-hailing platforms leave travelers fragmented, RideSync introduces an intelligent coordination layer that connects distinct passengers traveling along overlapping routes in real time. 
![License](https://img.shields.io/badge/license-ISC-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/JavaScript-12.x-yellow)
![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748)
![Status](https://img.shields.io/badge/status-beta-orange)

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Real-time Events](#real-time-events)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## 🧭 Overview

RideSync is a full-stack ride-sharing and carpooling application built for the Indian market. It supports real-time driver-rider matching, live GPS tracking, OTP-based authentication, and integrated payments via Razorpay.

Currently in **beta** — built for MVP and real-user testing.

---

## ✨ Features

- 🔐 **Auth** — Phone OTP verification, JWT + Refresh token system
- 🗺️ **Ride Matching** — Redis GEO-based real-time driver matching
- 📍 **Live Tracking** — Socket.io powered GPS updates
- 💰 **Fare Calculation** — Distance-based dynamic pricing (Haversine formula)
- 👤 **Dual Role** — Separate Rider and Driver flows
- 🚗 **Driver Management** — Vehicle registration, KYC, approval flow
- 💳 **Payments** — Razorpay integration (coming soon)
- 🔔 **Notifications** — In-app notification system
- ⭐ **Ratings** — Mutual rider-driver rating system
- 👛 **Wallet** — In-app wallet with transaction history

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| TypeScript | Type safety |
| Prisma ORM | Database access |
| Socket.io | Real-time communication |
| Redis (Upstash) | Live location, caching, ride locks |
| JWT | Authentication |
| Zod | Validation |
| bcryptjs | Password hashing |

### Database & Infrastructure
| Service | Purpose | Plan |
|---|---|---|
| Supabase | PostgreSQL database | Free |
| Upstash | Redis cache | Free |
| Render | Backend hosting | Free |
| Vercel | Frontend hosting | Free |

### Frontend
| Technology | Purpose |
|---|---|
| Next.js | React framework |
| Firebase (legacy) | Being migrated |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    RideSync Platform                  │
├──────────────┬──────────────┬───────────────────────┤
│   Supabase   │    Upstash   │      Socket.io         │
│  PostgreSQL  │    Redis     │                        │
│              │              │                        │
│ • Users      │ • Driver GPS │ • Live tracking        │
│ • Rides      │ • Online     │ • Ride events          │
│ • Payments   │   status     │ • Notifications        │
│ • Auth       │ • Ride locks │ • Driver ↔ Rider       │
│ • History    │ • OTP cache  │   updates              │
└──────────────┴──────────────┴───────────────────────┘
```

**Flow:**
```
Rider requests ride
      ↓
Redis GEORADIUS → finds nearby online drivers
      ↓
PostgreSQL → fetches driver ratings + vehicle info
      ↓
Socket.io → notifies best matched driver
      ↓
Driver accepts → Redis locks ride (no double booking)
      ↓
PostgreSQL → saves ride record permanently
      ↓
Socket.io → notifies rider with driver details
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/ridesync.git
cd ridesync
```

### 2. Setup Backend

```bash
cd backend
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Fill in your values (see Environment Variables section)
```

### 4. Setup database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run development server

```bash
npm run dev
```

Server runs at `http://localhost:5000`

### 6. Health check

```bash
curl http://localhost:5000/health
```

---

## 🔐 Environment Variables

Create `backend/.env`:

```env
# PostgreSQL — Supabase
DATABASE_URL="postgresql://postgres.[ref]:[password]@[host]:6543/postgres?sslmode=require"

# Redis — Upstash
REDIS_URL="rediss://default:[password]@[host].upstash.io:6379"

# JWT
JWT_SECRET="your_jwt_secret_here"
JWT_REFRESH_SECRET="your_refresh_secret_here"

# App
PORT=5000
NODE_ENV=development
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Auth Routes

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register rider or driver | ❌ |
| POST | `/auth/verify-otp` | Verify phone OTP | ❌ |
| POST | `/auth/login` | Login with email + password | ❌ |
| POST | `/auth/refresh` | Refresh access token | ❌ |
| POST | `/auth/logout` | Logout user | ✅ |

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9999999999",
  "password": "SecurePass@123",
  "role": "RIDER"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

---

### Ride Routes

| Method | Endpoint | Description | Role |
|---|---|---|---|
| POST | `/rides/request` | Request a new ride | RIDER |
| GET | `/rides/:id` | Get ride details | RIDER/DRIVER |
| POST | `/rides/:id/accept` | Accept a ride | DRIVER |
| POST | `/rides/:id/pickup` | Mark rider picked up | DRIVER |
| POST | `/rides/:id/complete` | Complete the ride | DRIVER |
| POST | `/rides/:id/cancel` | Cancel a ride | RIDER/DRIVER |

#### Request Ride
```http
POST /api/rides/request
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "pickupAddress": "Sambalpur Bus Stand",
  "pickupLat": 21.4669,
  "pickupLng": 83.9812,
  "dropAddress": "Sambalpur Railway Station",
  "dropLat": 21.4554,
  "dropLng": 83.9756
}
```

---

### Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Error response:
```json
{
  "success": false,
  "message": "Error description",
  "error": "detailed error"
}
```

---

## 🗄️ Database Schema

```
User
├── RiderProfile
├── DriverProfile
│   └── Vehicle
├── Wallet
│   └── WalletTransaction
├── Ride
│   ├── Payment
│   ├── Rating
│   └── RideStatusHistory
├── Notification
├── OtpVerification
└── RefreshToken
```

---

## ⚡ Real-time Events (Socket.io)

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `driver:online` | `{ driverId, lat, lng }` | Driver goes online |
| `driver:location` | `{ driverId, lat, lng }` | Driver updates GPS |
| `driver:offline` | `{ driverId }` | Driver goes offline |
| `rider:register` | `{ riderId }` | Rider registers socket |
| `driver:arrived` | `{ rideId, riderId }` | Driver arrived at pickup |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `driver:online:ack` | `{ status }` | Confirms driver is online |
| `ride:incoming` | ride data | New ride request for driver |
| `driver:location:update` | `{ lat, lng }` | Live driver location to rider |
| `driver:arrived` | `{ rideId }` | Driver arrived notification |

---

## 📁 Project Structure

```
ridesync/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts
│   │   │   ├── redis.ts
│   │   │   └── socket.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   └── ride.controller.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   └── ride.routes.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── ride.service.ts
│   │   ├── sockets/
│   │   │   └── ride.socket.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── fare.ts
│   │   │   ├── jwt.ts
│   │   │   └── response.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── src/                    ← Next.js frontend
    └── app/
```

---

## 🗺️ Roadmap

```
✅ Phase 1  Database setup (Supabase + Redis + Prisma)
✅ Phase 2  Auth system (Register, OTP, Login, JWT)
✅ Phase 3  Ride engine (Request, Match, Track, Complete)
⬜ Phase 4  Payments (Razorpay integration)
⬜ Phase 5  Deploy (Render + Vercel)
⬜ Phase 6  Beta launch 🚀
⬜ Phase 7  Scale (connection pooling, optimization)
```

---

## 🤝 Contributing

This project is currently in private beta. Contributions will be open after the first stable release.

---

## 📄 License

ISC © RideSync

---

> Built with ❤️ in India 🇮🇳 | Radhe Radhe 🙏
