# FinanceFlow — Multi-Subdomain Production Architecture & Deployment Guide

This document specifies the target multi-subdomain production architecture, cross-application session handling, DNS requirements, SPA fallback routing, and deployment procedures for FinanceFlow's four independent frontend applications and shared FastAPI backend.

---

## 1. Domain & Port Topology

### Production Subdomains
| Subdomain / URL | Application Scope | Hosting Target |
| :--- | :--- | :--- |
| **`https://financeflow.com`** | Platform Root | 301 Permanent Redirect to `dashboard.financeflow.com` (or Marketing Landing Page) |
| **`https://dashboard.financeflow.com`** | Connect Dashboard & SSO Launcher | Static SPA (S3+CloudFront, Vercel, Cloudflare Pages, Nginx) |
| **`https://crm.financeflow.com`** | FinanceFlow CRM Suite | Static SPA |
| **`https://toolkit.financeflow.com`** | Financial & KYC Document Toolkit | Static SPA |
| **`https://insurance.financeflow.com`** | Insurance & Renewal Engine | Static SPA |
| **`https://api.financeflow.com`** | Shared FastAPI Modular Monolith | Containerized ASGI (ECS, Kubernetes, Render, Railway, DigitalOcean) |

### Local Development Ports
| Local Port | Application | Dev Script | Production Build Script |
| :--- | :--- | :--- | :--- |
| **`http://localhost:5173`** | Connect Dashboard | `npm run dev:dashboard` | `npm run build:dashboard` |
| **`http://localhost:5174`** | FinanceFlow CRM | `npm run dev:crm` | `npm run build:crm` |
| **`http://localhost:5175`** | FinanceFlow Toolkit | `npm run dev:toolkit` | `npm run build:toolkit` |
| **`http://localhost:5176`** | Insurance Engine | `npm run dev:insurance` | `npm run build:insurance` |
| **`http://127.0.0.1:8000`** | Shared FastAPI Backend | `uvicorn app.main:app --port 8000` | N/A |

---

## 2. Cross-Subdomain Authentication & Single Sign-On (SSO)

FinanceFlow utilizes a hybrid defense-in-depth approach for authentication across subdomains:

```
                                [ User Browser ]
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
  https://dashboard.financeflow.com   https://crm.financeflow.com   https://toolkit.financeflow.com
     (Connect / Login)               (Borrowers 360)               (Calculators & Vault)
            │                                  ▲                          ▲
            │─── 1. Authenticates & Obtains    │                          │
            │    Dual JWT Tokens               │                          │
            │                                  │                          │
            │─── 2. Handoff URL with SSO Token ┘                          │
            │    (?sso_token=...&refresh=...)                             │
            │                                                             │
            └────────────────────── 3. Handoff URL with SSO Token ────────┘
```

### 1. Primary Strategy: Shared Wildcard Cookies (Production)
- In production with a custom domain, cookies issued by `https://api.financeflow.com` use:
  - `Domain=.financeflow.com`
  - `Secure=True` (HTTPS only)
  - `HttpOnly=True` (prevents XSS exfiltration of refresh token)
  - `SameSite=Lax` (enables cross-subdomain navigation while preventing CSRF)
- When a user signs in at `https://dashboard.financeflow.com`, the cookie is automatically transmitted on API calls from `crm.financeflow.com`, `toolkit.financeflow.com`, and `insurance.financeflow.com`.

### 2. Secondary Strategy: Cryptographic Token Handoff (Development & Cross-Port)
- In local development (`localhost:5173` vs `localhost:5174`) where browser origins differ by port, the application launcher appends a secure single-use token parameter:
  `http://localhost:5174?sso_token=<token>&refresh_token=<refresh>`
- Upon initialization, `tokenStorage.processSSOFromUrl()` in the receiving app:
  1. Stores the tokens securely in that origin's storage.
  2. Sanitizes the URL immediately using `window.history.replaceState()` without triggering a page reload, preventing token exposure in browser history or referrer headers.
  3. Validates the session with `GET /api/v1/auth/me`.

---

## 3. DNS & Hosting Configuration

### DNS Zone File Records
```dns
; Root domain redirect
@               IN  A      76.76.21.21          ; e.g., Edge CDN Anycast IP
@               IN  AAAA   2607:f8b0:4005:805:: ; Edge IPv6

; Subdomains
dashboard       IN  CNAME  cname.vercel-dns.com. ; or cloudfront.net
crm             IN  CNAME  cname.vercel-dns.com.
toolkit         IN  CNAME  cname.vercel-dns.com.
insurance       IN  CNAME  cname.vercel-dns.com.
api             IN  CNAME  alb.us-east-1.amazonaws.com. ; Load Balancer
```

### SSL / TLS Certificates
- Request a wildcard certificate covering `*.financeflow.com` and `financeflow.com` via Let's Encrypt / AWS ACM.
- Enforce HTTP-to-HTTPS redirect and HTTP Strict Transport Security (`HSTS`).

---

## 4. SPA Fallback Routing (Nginx Example)

Because each frontend is an independent Single Page Application (SPA) using React Router, any deep path (e.g., `https://crm.financeflow.com/customers/123`) must fall back to `/index.html`:

```nginx
# Configuration for crm.financeflow.com
server {
    listen 443 ssl http2;
    server_name crm.financeflow.com;

    ssl_certificate /etc/letsencrypt/live/financeflow.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/financeflow.com/privkey.pem;

    root /var/www/financeflow/crm/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static assets caching
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 5. Backend CORS Configuration

In `backend/.env` for production:
```env
CORS_ORIGINS=["https://dashboard.financeflow.com","https://crm.financeflow.com","https://toolkit.financeflow.com","https://insurance.financeflow.com","https://financeflow.com"]
```

FastAPI handles preflight `OPTIONS` requests automatically with `allow_credentials=True`.

---

## 6. Build and Deployment Commands

### Build All Frontends (Root)
```powershell
npm run build
```

### Build Each Frontend Independently
```powershell
# Dashboard
npm run build:dashboard
# Artifacts output to: d:/project/dashboard/dist/

# CRM
npm run build:crm
# Artifacts output to: d:/project/crm/dist/

# Toolkit
npm run build:toolkit
# Artifacts output to: d:/project/toolkit/dist/

# Insurance Engine
npm run build:insurance
# Artifacts output to: d:/project/insurance-engine/dist/
```

### Run All Frontends in Local Development Concurrently
```powershell
npm run dev
```

### Run Frontends Independently
```powershell
npm run dev:dashboard   # Starts on http://localhost:5173
npm run dev:crm         # Starts on http://localhost:5174
npm run dev:toolkit     # Starts on http://localhost:5175
npm run dev:insurance   # Starts on http://localhost:5176
```
