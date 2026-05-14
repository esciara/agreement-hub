# Agreement Hub

A minimal **Contract Lifecycle Management** application for managing agreements.

Create, view, edit, and delete contracts through a clean web UI backed by a RESTful API with local SQLite persistence — zero infrastructure required.

---

## Prerequisites

- **Node.js 20+** and **npm 10+**

Verify your versions:

```bash
node --version   # v20.x.x or higher
npm --version    # 10.x.x or higher
```

---

## Quick Start

Open two terminal windows.

**Terminal 1 — Backend (port 3001)**

```bash
cd backend
npm install
npm run dev
```

**Terminal 2 — Frontend (port 5173)**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
repository-root/
├── README.md                   # This file
├── docs/
│   └── use-cases/
│       └── README.md           # Functional use cases and reusable context
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .gitignore              # Ignores data/*.db and node_modules
│   ├── data/                   # SQLite database (auto-created, gitignored)
│   └── src/
│       ├── index.ts            # Express app bootstrap, listens on :3001
│       ├── db.ts               # SQLite init + schema migration (idempotent)
│       ├── types.ts            # Shared TypeScript types (Contract, ContractStatus)
│       └── routes/
│           └── contracts.ts    # All 5 contract API handlers + validation
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts          # Vite config with /api proxy to :3001
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx            # React entry point
        ├── App.tsx             # BrowserRouter + route definitions
        ├── api.ts              # Typed fetch wrappers for all API calls
        ├── types.ts            # Contract TypeScript types (mirrors backend)
        ├── components/
        │   ├── ContractForm.tsx # Shared create/edit form
        │   └── StatusBadge.tsx  # Colored status pill
        └── pages/
            ├── ContractList.tsx   # / — table of all contracts
            ├── ContractNew.tsx    # /contracts/new — create form
            ├── ContractDetail.tsx # /contracts/:id — read-only view
            └── ContractEdit.tsx   # /contracts/:id/edit — edit form
```

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 19 + Vite + TypeScript      |
| Styling    | Tailwind CSS v3                   |
| Routing    | React Router v7                   |
| Backend    | Node.js 20 + Express 4 + TypeScript |
| Database   | SQLite via `better-sqlite3`       |
| Dev runner | `tsx` (backend), Vite HMR (frontend) |

---

## npm Scripts

### Backend (`backend/`)

| Command         | Description                          |
|-----------------|--------------------------------------|
| `npm run dev`   | Start dev server with `tsx watch`    |
| `npm run build` | Compile TypeScript to `dist/`        |
| `npm start`     | Run compiled output (`dist/index.js`) |

### Frontend (`frontend/`)

| Command          | Description                           |
|------------------|---------------------------------------|
| `npm run dev`    | Start Vite dev server on port 5173    |
| `npm run build`  | Type-check + Vite production build    |
| `npm run preview`| Preview the production build (set `VITE_API_BASE_URL` — see `.env.example`) |

---

## API Reference

Base URL: `http://localhost:3001/api`

All request and response bodies are JSON. CORS is enabled for `http://localhost:5173`.

### Contract Object

```json
{
  "id": "uuid-v4",
  "title": "Master Services Agreement — Acme Corp",
  "customer_name": "Acme Corporation",
  "status": "draft",
  "created_at": "2024-03-15T10:30:00.000Z",
  "content": "This Agreement is entered into as of..."
}
```

**Status values:** `draft` | `active` | `expired` | `terminated`

---

### `GET /api/contracts`

List all contracts, ordered by creation date (newest first).

**Response `200`:** `Contract[]`

---

### `POST /api/contracts`

Create a new contract. `id` and `created_at` are assigned server-side.

**Request body:**
```json
{
  "title": "Software License Agreement",
  "customer_name": "Globex Corporation",
  "status": "draft",
  "content": "Optional full contract text..."
}
```

`status` defaults to `"draft"`. `content` defaults to `""`.

**Response `201`:** `Contract`  
**Response `400`:** `{ "error": "<message>" }` — validation failure

---

### `GET /api/contracts/:id`

Retrieve a single contract by ID.

**Response `200`:** `Contract`  
**Response `404`:** `{ "error": "Contract not found" }`

---

### `PUT /api/contracts/:id`

Full update of mutable fields. `id` and `created_at` are immutable and ignored in the body.

**Request body:**
```json
{
  "title": "Updated Agreement Title",
  "customer_name": "Globex Corporation",
  "status": "active",
  "content": "Updated contract body..."
}
```

**Response `200`:** `Contract` (updated)  
**Response `400`:** validation error  
**Response `404`:** not found

---

### `DELETE /api/contracts/:id`

Permanently delete a contract.

**Response `204`:** no content  
**Response `404`:** not found

---

### Validation Rules

| Field           | Rules                                                                 |
|-----------------|-----------------------------------------------------------------------|
| `title`         | Required, non-empty string, max 200 characters                        |
| `customer_name` | Required, non-empty string, max 200 characters                        |
| `status`        | Must be one of: `draft`, `active`, `expired`, `terminated`            |
| `content`       | Optional string, max 100,000 characters                               |

---

## Database

- SQLite database file: `backend/data/clm.db`
- Auto-created on first backend start
- `data/` directory is gitignored — never committed
- **Reset the DB:** `rm backend/data/clm.db` — the schema will be re-applied on next start

---

## Frontend Routes

| Path                    | Page              | Description                          |
|-------------------------|-------------------|--------------------------------------|
| `/`                     | ContractList      | Table of all contracts               |
| `/contracts/new`        | ContractNew       | Form to create a new contract        |
| `/contracts/:id`        | ContractDetail    | Read-only view with edit/delete      |
| `/contracts/:id/edit`   | ContractEdit      | Pre-filled edit form                 |

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so no hardcoded API URL is needed in the frontend during development.

> **Note:** `npm run preview` does **not** use the Vite proxy. To use the preview server with a running backend, create `frontend/.env.local` and set `VITE_API_BASE_URL=http://localhost:3001` (see `frontend/.env.example`).

---

## Functional Use Cases

Future product use cases are documented in [`docs/use-cases/`](docs/use-cases/).
