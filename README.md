# Task Management System

A full-stack Task Management System for managing Bank Loan & Subsidy Applications built with **Node.js + MongoDB** backend and **React + Vite + Tailwind CSS** frontend.

---

## 📁 Project Structure

```
website/
├── client/                   # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/       # Button, Input, Table, Modal, Badge, etc.
│   │   │   └── layout/       # Sidebar, Navbar, MainLayout, Breadcrumb
│   │   ├── hooks/            # useAuth, useDebounce, usePageTitle, usePermission
│   │   ├── pages/            # Dashboard, Clients, Vendors, BankLoans, Subsidies,
│   │   │                     # Reports, Configuration, Users, Profile, Notifications
│   │   ├── services/         # Axios API service functions per module
│   │   ├── store/            # Zustand: authStore, configStore, notificationStore
│   │   └── utils/            # constants, dateFormat, permissions, exportPDF, exportExcel
│   └── vite.config.js
│
├── controllers/              # All API controllers
├── middleware/               # Auth, error, rate limiting, audit logging
├── models/                   # Mongoose models
├── routes/                   # Express routers
├── utils/                    # ApiResponse, ApiError, helpers
├── config/                   # db.js
├── app.js
└── server.js
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas or local instance
- npm

### 1. Backend Setup

```bash
# Install backend dependencies
npm install

# Copy and configure environment variables
copy .env.example .env

# Required env vars:
# MONGODB_URI=your_mongodb_connection_string
# JWT_SECRET=your_jwt_secret_key_min_32_chars
# JWT_REFRESH_SECRET=your_refresh_secret
# PORT=5000

# Seed the database (creates admin user)
node seed.js

# Start the backend
npm run dev
```

### 2. Frontend Setup

```bash
cd client
npm install

# Configure env
copy .env.example .env
# Set: VITE_API_URL=http://localhost:5000/api

npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Default Credentials (after seeding)

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Data Entry | `dataentry` | `Data@123` |
| Viewer | `viewer` | `Viewer@123` |

---

## 🌐 Deploying to Vercel

### Backend
1. Push to GitHub, import in Vercel
2. Set Root Directory to `/`
3. Add all env variables in Vercel dashboard

### Frontend
1. Import same repo, set Root Directory to `client/`
2. Build command: `npm run build`, Output: `dist`
3. Set `VITE_API_URL` to your backend Vercel URL

---

## 🏗️ Tech Stack

### Backend
Node.js + Express · MongoDB + Mongoose · JWT · bcryptjs · express-validator · helmet · cors · rate-limit

### Frontend
React 18 · Vite · Tailwind CSS · React Router v6 · TanStack Query · Zustand · Axios · React Hook Form · Recharts · Lucide React · React Hot Toast · date-fns · jsPDF · xlsx

---

## 📋 Features

- ✅ JWT auth with role-based access (Admin / Data Entry / Viewer)
- ✅ Client management with duplicate detection
- ✅ Vendor management with statistics
- ✅ Bank Loan & Subsidy application lifecycle
- ✅ Document checklist with per-file status tracking
- ✅ Query management (raise, track, resolve)
- ✅ Status change with full audit trail / timeline
- ✅ Dashboard with Recharts analytics
- ✅ 6 report types with Excel & PDF export
- ✅ Document type & status configuration (Admin)
- ✅ User management with password reset (Admin)
- ✅ Notification center with unread badge

---

## 🔒 Role Permissions

| Feature | Admin | Data Entry | Viewer |
|---------|:-----:|:----------:|:------:|
| Dashboard | ✅ | ✅ | ✅ |
| Clients Write | ✅ | ✅ | ❌ |
| Clients Delete | ✅ | ❌ | ❌ |
| Applications Write | ✅ | ✅ | ❌ |
| Applications Delete | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ |
| Performance Reports | ✅ | ❌ | ✅ |
| Audit Logs | ✅ | ❌ | ❌ |
| Configuration | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |
