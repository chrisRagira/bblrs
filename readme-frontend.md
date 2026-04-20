# BBLRS Kenya — Frontend

**Blockchain-Based Land Registry System**  
Egerton University · Built on Hyperledger Fabric 2.5

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set API base URL (optional — defaults to https://bblrs.local/api/v1)
echo "VITE_API_BASE_URL=http://localhost:3000/api/v1" > .env

# 3. Start dev server
npm run dev        # → http://localhost:5173

# 4. Production build
npm run build
```

---

## Project Structure

```
bblrs/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                        # React entry point
    │
    ├── api/
    │   ├── axios.js                    # Axios instance + JWT interceptors
    │   └── services.js                 # All API service functions
    │
    ├── context/
    │   └── AuthContext.jsx             # Global auth state (localStorage-backed)
    │
    ├── hooks/
    │   └── useApi.js                   # useApi() + useMutation() hooks
    │
    ├── routes/
    │   ├── AppRouter.jsx               # All routes defined centrally
    │   └── ProtectedRoute.jsx          # Role-based route guard
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.jsx           # Navbar + <Outlet /> + Footer
    │   │   ├── Navbar.jsx              # Sticky nav with role-aware links
    │   │   └── Footer.jsx
    │   └── ui/
    │       ├── Badge.jsx               # Status badge (ACTIVE, PENDING, etc.)
    │       ├── Button.jsx              # Primary / secondary / teal / danger / ghost
    │       ├── Card.jsx                # Card, StatCard, PageHeader
    │       ├── Feedback.jsx            # Alert, Breadcrumb, StepBar, TabBar, Spinner, EmptyState
    │       ├── FormField.jsx           # FormField, SelectField, TextArea
    │       ├── OwnershipTimeline.jsx   # Chain-of-title vertical timeline
    │       └── ParcelCard.jsx          # Parcel summary row card
    │
    ├── pages/
    │   ├── LandingPage.jsx             # Public hero + search + features
    │   ├── LoginPage.jsx               # Credentials + MFA OTP step
    │   ├── RegisterPage.jsx            # 3-step registration wizard
    │   ├── SearchResults.jsx           # Parcel search with status filters
    │   ├── ParcelDetail.jsx            # Tabbed parcel view (RBAC-aware actions)
    │   ├── Dashboard.jsx               # Role-aware post-login dashboard
    │   ├── TransferForm.jsx            # 3-step transfer initiation wizard
    │   ├── RegistrarQueue.jsx          # Approve / reject pending transfers
    │   ├── RegisterParcel.jsx          # 4-step parcel registration (Registrar)
    │   ├── UploadDocument.jsx          # IPFS document upload + CID anchor
    │   ├── EncumbranceManager.jsx      # Register / discharge encumbrances
    │   ├── AuditLog.jsx                # Filterable audit event table
    │   ├── AdminUsers.jsx              # User management + role assignment
    │   ├── DocumentVerifier.jsx        # Hash-based document verification
    │   └── NotFound.jsx                # 404 page
    │
    ├── styles/
    │   ├── global.css                  # CSS variables, utility classes, base styles
    │   └── tokens.js                   # JS design tokens (colours, fonts, shadows)
    │
    └── utils/
        └── helpers.js                  # formatKES, shortHash, formatDate, initials
```

---

## Route Map & Access Control

| Route                          | Page                  | Roles Allowed                   |
|--------------------------------|-----------------------|---------------------------------|
| `/`                            | LandingPage           | Public                          |
| `/login`                       | LoginPage             | Public                          |
| `/register`                    | RegisterPage          | Public                          |
| `/search`                      | SearchResults         | Public                          |
| `/parcels/:id`                 | ParcelDetail          | Public                          |
| `/verify`                      | DocumentVerifier      | Public                          |
| `/dashboard`                   | Dashboard             | Any authenticated               |
| `/transfers/new`               | TransferForm          | LANDOWNER, LEGAL                |
| `/parcels/:id/upload`          | UploadDocument        | REGISTRAR                       |
| `/registrar/queue`             | RegistrarQueue        | REGISTRAR                       |
| `/registrar/parcels/new`       | RegisterParcel        | REGISTRAR                       |
| `/registrar/encumbrances`      | EncumbranceManager    | REGISTRAR, FINANCIAL            |
| `/admin/users`                 | AdminUsers            | ADMIN                           |
| `/admin/audit`                 | AuditLog              | ADMIN, REGISTRAR                |

---

## Authentication Flow

```
LoginPage
  │
  ├─ POST /auth/login
  │     ├─ { requiresMfa: false } → store token → redirect
  │     └─ { requiresMfa: true  } → show OTP step
  │           └─ POST /auth/mfa/verify → store token → redirect
  │
  └─ Token stored in:
       localStorage.token   (JWT access token)
       localStorage.role    (user role string)
       localStorage.user    (serialised user object)
```

`AuthContext` hydrates from `localStorage` on page load so sessions survive refresh.  
`ProtectedRoute` reads `isAuthenticated` + `role` from context and redirects unauthenticated or unauthorised users.

---

## API Layer

All HTTP calls go through `src/api/axios.js` which:
- Sets `Authorization: Bearer <token>` on every request via a request interceptor
- Catches `401` responses globally, clears localStorage, and redirects to `/login`

Service modules in `src/api/services.js` group calls by domain:

```js
import { parcelsApi, transfersApi, authApi, adminApi, encumbrancesApi, verifyApi } from "./api/services";
```

---

## Environment Variables

| Variable              | Default                           | Description                |
|-----------------------|-----------------------------------|----------------------------|
| `VITE_API_BASE_URL`   | `https://bblrs.local/api/v1`      | Express REST API base URL  |

---

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Framework    | React 18 + Vite 5                       |
| Routing      | React Router v6                         |
| HTTP Client  | Axios with JWT interceptors             |
| Auth State   | React Context + useReducer + localStorage |
| Styling      | Plain CSS (no framework) + CSS variables |
| Fonts        | Playfair Display (headings), DM Sans (body), JetBrains Mono (code) |
| Backend      | Node.js / Express (separate repo)       |
| Blockchain   | Hyperledger Fabric 2.5                  |

---

## Demo Credentials (for local dev without API)

All pages fall back to static demo data when the API is unreachable.  
To simulate login, the `LoginPage` accepts any credentials — choose the role from the dropdown and submit.

| Role       | Dashboard shows                                  |
|------------|--------------------------------------------------|
| LANDOWNER  | Owned parcels + notification feed                |
| REGISTRAR  | Approval queue + parcel management shortcuts     |
| ADMIN      | User management table                            |
| FINANCIAL  | Encumbrance manager                              |

---

*Prepared by Christopher Anunda Ragira · SP13/06831/20 · Egerton University*
