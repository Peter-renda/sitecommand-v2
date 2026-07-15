# ERP Integration Spec & Data Dictionary

**Audience:** Engineers and support staff  
**Last updated:** 2026-06-17  
**Scope:** QuickBooks Online (QBO) and Sage 300 CRE (via Agave) integrations, including push sync, pull (budget resync), OAuth/connect flows, accounting feedback, and all supporting database schema.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Configuration Reference](#2-configuration-reference)
3. [API Endpoint Catalog](#3-api-endpoint-catalog)
4. [Entity Crosswalk](#4-entity-crosswalk)
5. [Field-Level Data Dictionary](#5-field-level-data-dictionary)
6. [Budget Code Map (QBO_BUDGET_CODE_MAP)](#6-budget-code-map-qbo_budget_code_map)
7. [Pull Direction — ERP → Budget](#7-pull-direction--erp--budget)
8. [Accounting Feedback Schema](#8-accounting-feedback-schema)
9. [Idempotency & Sync State](#9-idempotency--sync-state)
10. [Database Schema Reference](#10-database-schema-reference)
11. [Error Code Reference](#11-error-code-reference)
12. [Data Types & Precision Rules](#12-data-types--precision-rules)

---

## 1. Overview

### Scope

SiteCommand supports two accounting ERP integrations:

| Integration | Product | Connectivity model | Direction |
|---|---|---|---|
| QuickBooks Online (QBO) | Intuit cloud accounting | Direct REST via `api.quickbooks.com` | Push + Pull |
| Sage 300 CRE | Sage on-premise (formerly Timberline) | Agave cloud connector agent (`api.agaveapi.com`) | Push + Pull |

**Important:** The `SageNADev/Sage300-SDK` GitHub repository is the Sage 300 Accpac Web SDK — a UI-screen toolkit for a different Sage product. It has no external data API and is unrelated to this integration. The `lib/sage-intacct.ts` file is Sage Intacct, yet another separate product. This document covers Sage 300 **CRE** only, accessed through Agave.

### Mutual Exclusion Rule

A company may connect **either** QuickBooks Online **or** Sage 300 CRE — not both simultaneously. This is enforced at connect time and at runtime:

- **QBO connect** (`GET /api/integrations/quickbooks/connect`): redirects with `error=qbo_other_erp_connected` if `SAGE300CRE_ACCOUNT_TOKEN` is present in `company_integrations`.
- **Sage connect** (`POST /api/integrations/sage300cre/connect`): returns HTTP 422 if QBO is connected.
- **Budget resync** (`POST /api/integrations/erp/resync-budget`): returns HTTP 422 with message `"Both QuickBooks and Sage 300 CRE are connected..."` if both are connected (handles pre-existing dual connections from before enforcement was added).

### Connectivity Model

**QuickBooks Online**

```
SiteCommand → HTTPS REST → api.quickbooks.com/v3/company/{realmId}/{resource}?minorversion=65
```

- Authentication: OAuth 2.0 (Authorization Code Flow). Tokens stored in `company_integrations` as `QBO_ACCESS_TOKEN` (Bearer, ~1 hour) and `QBO_REFRESH_TOKEN` (~100 days).
- Token refresh: automatic on 401 (one retry); new tokens persisted back to `company_integrations`.
- All requests include `Accept: application/json` and `Content-Type: application/json`.
- Minor version hardcoded to `65` appended to every URL as `?minorversion=65`.

**Sage 300 CRE via Agave**

```
SiteCommand → HTTPS REST → api.agaveapi.com/{resource}
                Headers: Client-Id, Client-Secret, Account-Token, API-Version
```

- Authentication: Agave app credentials (`Client-Id` + `Client-Secret`) plus a per-company `Account-Token` obtained through Agave Link OAuth.
- No token refresh needed — the Account Token is durable.
- `API-Version` header defaults to `2021-11-21`.

---

## 2. Configuration Reference

### 2.1 QuickBooks Online

#### App Credentials

Resolution order for each key: `company_integrations` row → `platform_settings` row → environment variable.

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `QBO_CLIENT_ID` | string | **Required** | — | Intuit Developer OAuth app client ID. Must match the app registered at developer.intuit.com. |
| `QBO_CLIENT_SECRET` | string | **Required** | — | Intuit Developer OAuth app client secret. |
| `INTUIT_REDIRECT_URI` | string | Optional | Falls back to `NEXT_PUBLIC_APP_URL + /api/integrations/quickbooks/callback`, then request-derived origin | OAuth callback URI. **Must match verbatim** what is registered in the Intuit Developer portal. Mismatches cause `redirect_uri_mismatch` from Intuit. |
| `INTUIT_OAUTH_SCOPES` | string | Optional | `"com.intuit.quickbooks.accounting"` | Space-separated OAuth scopes. |

#### Company Credentials (set automatically via OAuth; stored in `company_integrations`)

| Key | Type | Set by | Description |
|---|---|---|---|
| `QBO_REALM_ID` | string | OAuth callback | QBO company file identifier (realmId). Included in every API URL. |
| `QBO_ACCESS_TOKEN` | string | OAuth callback + auto-refresh | Bearer token. ~1-hour lifetime. Sent as `Authorization: Bearer {token}`. |
| `QBO_REFRESH_TOKEN` | string | OAuth callback + auto-refresh | Used to mint new access tokens. ~100-day lifetime. |

#### Posting Configuration

Resolution order: `company_integrations` row → environment variable. All optional.

| Key | Type | Default | Description |
|---|---|---|---|
| `QBO_ENVIRONMENT` | `"sandbox"` \| `"production"` | `"production"` | Selects Intuit API base URL. `sandbox` uses `sandbox-quickbooks.api.intuit.com`; `production` uses `quickbooks.api.intuit.com`. OAuth authorize/token URLs are identical. The Settings UI shows a blue **Sandbox** badge when sandbox is active. Can be set per-company via the Settings → Integrations environment dropdown. |
| `QBO_API_BASE` | string | Derived from `QBO_ENVIRONMENT` | Full override of the QBO REST base URL (e.g. for test proxies). Takes precedence over `QBO_ENVIRONMENT`. |
| `QBO_AP_EXPENSE_ACCOUNT` | string | Auto-detect first COGS/Expense account | Account name (exact display name) for Bill line `AccountRef`. When unset, the sync code queries QBO accounts and selects the first active Expense or COGS account. |
| `QBO_RETAINAGE_PAYABLE_ACCOUNT` | string | — (disabled) | AP retainage account name. When set, the Bill sync emits an additional negative retainage line: `-(billed_to_date × default_retainage%)` posted to this account. Omitted if pct = 0 or key is unset. |
| `QBO_RETAINAGE_RECEIVABLE_ACCOUNT` | string | — (disabled) | AR retainage account name. When set, a QBO Item named `"Retainage"` is auto-created/resolved, and a negative retainage line is appended to AR Invoices. |
| `QBO_DEFAULT_ITEM` | string | `"Services"` | Item name for PO/Invoice lines when no `item` is found in `QBO_BUDGET_CODE_MAP` for a given code. Auto-created in QBO if absent. |
| `QBO_PROJECT_TRACKING` | `"class"` \| `"none"` | `"class"` | When `"class"`, every line includes a `ClassRef` referencing a QBO Class auto-named after the SiteCommand project. Set to `"none"` to disable Class tracking entirely. |
| `QBO_DOC_NUMBER_PREFIX` | string | — (bare number) | `"project"` = prefix DocNumber with `{project.number}-{commitment.number}`, capped at 21 characters total. Any other string = literal prefix prepended verbatim. Unset = bare record number. |
| `QBO_BUDGET_CODE_MAP` | JSON string | `{}` | Maps SiteCommand budget codes to QBO accounts/items/classes. Full schema in [Section 6](#6-budget-code-map-qbo_budget_code_map). |

#### Hardcoded Values

| Constant | Value | Notes |
|---|---|---|
| API minor version | `65` | Appended as `?minorversion=65` to every QBO REST URL. |

---

### 2.2 Sage 300 CRE (via Agave)

#### App Credentials

Resolution order: `company_integrations` → `platform_settings` → environment variable.

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `SAGE300CRE_CLIENT_ID` | string | **Required** | — | Agave app client ID. Obtained from Agave developer portal. Sent as `Client-Id` header. |
| `SAGE300CRE_CLIENT_SECRET` | string | **Required** | — | Agave app client secret. Sent as `Client-Secret` header. |

#### Company Credentials (stored in `company_integrations`)

| Key | Type | Set by | Description |
|---|---|---|---|
| `SAGE300CRE_ACCOUNT_TOKEN` | string | `/exchange` route | Durable Agave account token for this company's Sage 300 CRE instance. Sent as `Account-Token` header. Does not expire (unlike OAuth tokens). |

#### Agave Configuration

| Key | Type | Default | Description |
|---|---|---|---|
| `AGAVE_API_BASE` | string | `"https://api.agaveapi.com"` | Override Agave REST base URL. |
| `AGAVE_API_VERSION` | string | `"2021-11-21"` | Value for the `API-Version` header on every Agave request. |

---

### 2.3 General / Shared

| Key | Type | Required | Description |
|---|---|---|---|
| `CRON_SECRET` | string | **Required** | Secures cron endpoints. Passed as `Authorization: Bearer {CRON_SECRET}` by Vercel cron; routes reject without it. |
| `NEXT_PUBLIC_APP_URL` | string | Recommended | Canonical app origin. Used in QBO redirect URI fallback and for post-OAuth browser redirects (`getAppOrigin()`). |

---

## 3. API Endpoint Catalog

### 3.1 QuickBooks Online Routes

#### `GET /api/integrations/quickbooks/connect`

Initiates QBO OAuth Authorization Code flow.

**Auth:** Session required; company role must be `super_admin` or `site_admin`.

**Behavior:**
1. Validates session and role; redirects with error on failure.
2. Checks that Sage 300 CRE is **not** already connected; redirects with `error=qbo_other_erp_connected` if so.
3. Generates a CSRF nonce; sets `qbo_oauth_state` httpOnly cookie (10-minute TTL).
4. Redirects browser to Intuit authorization URL with `state={nonce}`, `redirect_uri`, and `scope`.

**Success:** Browser redirect to Intuit consent screen.

**Error redirects to `/settings/integrations?error=...`:**

| Error param | Cause |
|---|---|
| `qbo_unauthorized` | No session |
| `qbo_forbidden` | Not super_admin/site_admin |
| `qbo_no_company` | Session has no company_id |
| `qbo_not_configured` | QBO_CLIENT_ID missing |
| `qbo_other_erp_connected` | Sage 300 CRE account token present |

---

#### `GET /api/integrations/quickbooks/callback`

Receives OAuth authorization code from Intuit; exchanges for tokens.

**Auth:** CSRF state cookie + state param match.

**Query params:** `code` (auth code), `realmId`, `state` (nonce), `error` (if user denied).

**Behavior:**
1. If `error` present → redirect with `qbo_denied?reason={error}`.
2. Validates `code`, `realmId`, `state` present → `qbo_invalid_callback` if missing.
3. Validates `state` matches `qbo_oauth_state` cookie → `qbo_invalid_state` if mismatch. Always clears cookie.
4. Exchanges code for tokens via Intuit token endpoint.
5. Upserts `QBO_REALM_ID`, `QBO_ACCESS_TOKEN`, `QBO_REFRESH_TOKEN` in `company_integrations`.
6. Redirects browser to `{NEXT_PUBLIC_APP_URL}/settings/integrations?connected=quickbooks`.

**Error redirects to `/settings/integrations?error=...`:**

| Error param | Cause |
|---|---|
| `qbo_denied` | User clicked "Cancel" on Intuit consent; includes `reason=` |
| `qbo_invalid_callback` | Missing code, realmId, or state param |
| `qbo_invalid_state` | CSRF nonce mismatch |
| `qbo_missing_app_creds` | Client ID/Secret missing at callback time |
| `qbo_token_exchange_failed` | Intuit token POST returned non-200; includes `reason=` |

---

#### `POST /api/integrations/quickbooks/disconnect`

Revokes QBO tokens and removes stored credentials.

**Auth:** Session; `super_admin` or `site_admin`.

**Behavior:**
1. Calls Intuit revoke endpoint with the current refresh token (best-effort; failure does not abort).
2. Deletes `QBO_REALM_ID`, `QBO_ACCESS_TOKEN`, `QBO_REFRESH_TOKEN` from `company_integrations`.
3. Retains `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, environment, and `QBO_BUDGET_CODE_MAP`.

**Response (200):** `{ "ok": true }`

---

#### `POST /api/integrations/quickbooks/sync`

Manual sync of a single record to QBO.

**Auth:** Session; company member (any role with company access).

**Request body:**

```json
{
  "recordType": "commitments" | "prime_contracts" | "ap_invoice" | "ar_invoice",
  "recordId": "<uuid>"
}
```

**Response (200):**

```json
{
  "ok": true,
  "action": "synced" | "deleted" | "closed" | "voided" | "skipped",
  "qboId": "<QBO entity Id>",
  "message": "<human-readable detail (optional)>"
}
```

**Error responses:**

| HTTP | Condition |
|---|---|
| 400 | `recordType` or `recordId` missing or invalid |
| 422 | QBO not connected; no Contract Company / Owner-Client on record; no company on session |
| 502 | QBO API error (Intuit fault or network failure) |

---

#### `POST /api/integrations/quickbooks/refresh`

Re-reads payment status for a single record from QBO without a full re-push.

**Auth:** Session; company member.

**Request body:**

```json
{
  "recordType": "commitments" | "prime_contracts",
  "recordId": "<uuid>"
}
```

**Response (200):**

```json
{
  "ok": true,
  "paymentStatus": "paid" | "partially_paid" | "unpaid",
  "balance": 12345.67,
  "totalAmount": 50000.00
}
```

**Error:** HTTP 422 if record has never been synced (`qbo_id` is null).

---

#### `GET /api/integrations/quickbooks/accounts`

Returns active QBO accounts of type Expense, COGS, or Other Expense. Used to populate the Budget Code Map UI.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):**

```json
{
  "accounts": [
    { "Id": "123", "Name": "Construction Costs", "AccountType": "Cost of Goods Sold" }
  ]
}
```

---

#### `GET /api/integrations/quickbooks/items`

Returns active QBO Items / Products & Services. Used to populate the Budget Code Map UI item picker.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):**

```json
{
  "items": [
    { "Id": "45", "Name": "02-310.C", "Type": "Service" }
  ]
}
```

---

#### `GET /api/integrations/quickbooks/customers`

Returns active QBO Customers.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):** `{ "customers": [{ "Id": "...", "DisplayName": "..." }] }`

---

#### `GET /api/integrations/quickbooks/vendors`

Returns active QBO Vendors.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):** `{ "vendors": [{ "Id": "...", "DisplayName": "..." }] }`

---

#### `GET /api/integrations/quickbooks/projects`

Returns QBO Projects (IsProject=true Customers) sorted first, then Customer:Job sub-customers, then plain Customers. Used for the Project Admin → ERP Integration → QuickBooks Project/Customer picker.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):**

```json
{
  "projects": [
    { "Id": "77", "DisplayName": "Riverside Tower", "IsProject": true }
  ]
}
```

---

#### `GET /api/integrations/quickbooks/logs`

Returns the 10 most recent sync log entries for a specific record.

**Auth:** Session; company member.

**Query params:** `recordType` (string), `recordId` (UUID).

**Response (200):**

```json
{
  "logs": [
    {
      "id": "<uuid>",
      "record_type": "commitments",
      "record_id": "<uuid>",
      "integration": "quickbooks",
      "result": "success",
      "sage_key": "Bill:123",
      "error_message": null,
      "synced_at": "2026-06-17T14:23:00Z"
    }
  ]
}
```

---

### 3.2 Sage 300 CRE Routes

#### `POST /api/integrations/sage300cre/connect`

Creates an Agave Link token for the Agave Link UI flow.

**Auth:** Session; `super_admin` or `site_admin`.

**Behavior:**
1. Validates Agave app credentials present; returns 422 with guidance if missing.
2. Checks QBO is **not** connected; returns 422 if so.
3. Calls Agave `POST /link/token/create` with client credentials.
4. Returns the link token for the frontend to initialize Agave Link.

**Response (200):**

```json
{ "linkToken": "<agave-link-token>" }
```

**Errors:** HTTP 422 on missing credentials or QBO already connected (see [Section 11](#11-error-code-reference)).

---

#### `POST /api/integrations/sage300cre/exchange`

Exchanges an Agave public token (from Agave Link completion) for a durable Account Token.

**Auth:** Session; `super_admin` or `site_admin`.

**Request body:**

```json
{ "publicToken": "<agave-public-token>" }
```

**Behavior:**
1. Calls Agave `POST /link/token/exchange` with `{ public_token }`.
2. Stores returned `account_token` as `SAGE300CRE_ACCOUNT_TOKEN` in `company_integrations`.

**Response (200):** `{ "ok": true }`

---

#### `POST /api/integrations/sage300cre/disconnect`

Removes the Sage 300 CRE account token.

**Auth:** Session; `super_admin` or `site_admin`.

**Behavior:** Deletes `SAGE300CRE_ACCOUNT_TOKEN` from `company_integrations`. Retains app credentials.

**Response (200):** `{ "ok": true }`

---

#### `POST /api/integrations/sage300cre/sync`

Manual sync of a single record to Sage 300 CRE.

**Auth:** Session; company member.

**Request body:** Same shape as QBO sync — `{ recordType, recordId }` where `recordType` is `commitments | prime_contracts | ap_invoice | ar_invoice`.

**Response (200):**

```json
{
  "ok": true,
  "action": "created" | "updated",
  "sageId": "<Agave resource Id>"
}
```

**Error responses:**

| HTTP | Condition |
|---|---|
| 400 | Missing/invalid recordType or recordId |
| 422 | Sage not connected; vendor/customer not found in Sage; no company on session |
| 502 | Agave API error |

---

#### `POST /api/integrations/sage300cre/refresh`

Re-reads payment status for a single record from Agave/Sage.

**Auth:** Session; company member.

**Request body:** `{ "recordType": "commitments" | "prime_contracts", "recordId": "<uuid>" }`

**Response (200):** `{ "ok": true, "paymentStatus": "...", "balance": 0.00, "totalAmount": 0.00 }`

---

#### `GET /api/integrations/sage300cre/vendors`

Returns Sage vendors via Agave `GET /vendors`.

**Auth:** Session; `super_admin` or `site_admin`.

**Response (200):** `{ "vendors": [{ "id": "...", "name": "..." }] }`

---

#### `GET /api/integrations/sage300cre/logs`

Returns the 10 most recent `erp_sync_logs` rows for a record where `integration = 'sage300cre'`.

**Auth:** Session; company member.

**Query params:** `recordType`, `recordId`.

**Response (200):** Same shape as QBO logs endpoint.

---

### 3.3 Shared ERP Routes

#### `GET /api/integrations/erp/status`

Returns which ERP is connected for the calling user's company.

**Auth:** Session; company member.

**Response (200):**

```json
{
  "quickbooks": true,
  "sage300cre": false,
  "connected": "quickbooks" | "sage300cre" | "multiple" | null
}
```

`"multiple"` is only possible if enforcement was added after both were connected. All push/pull routes treat this as an error state.

---

#### `POST /api/integrations/erp/resync-budget`

Pulls job-to-date actual costs from the connected ERP and writes them to `budget_line_items.job_to_date_costs` matched by `cost_code`.

**Auth:** Session; must be a member of the company that owns the project. External collaborators are rejected (403).

**Request body:**

```json
{ "projectId": "<uuid>" }
```

**Behavior:**
1. Validates `projectId` present (400) and project exists (404).
2. Checks caller belongs to project's company (403).
3. Calls `GET /api/integrations/erp/status`; errors on `multiple` or `null`.
4. Loads distinct `cost_code` values from `budget_line_items` for the project.
5. Calls ERP-specific cost-pull function (see [Section 7](#7-pull-direction--erp--budget)).
6. `UPDATE budget_line_items SET job_to_date_costs = $1 WHERE project_id = $2 AND cost_code = $3`.
7. Writes an `erp_sync_logs` row: `record_type = 'budget_job_to_date'`.
8. Returns summary.

**Response (200):**

```json
{
  "ok": true,
  "erp": "quickbooks" | "sage300cre",
  "matched": 12,
  "updated": 10,
  "warning": "<optional human-readable warning>"
}
```

**Error responses:**

| HTTP | Body | Condition |
|---|---|---|
| 400 | `"projectId is required"` | Body missing projectId |
| 403 | `"Forbidden"` | Project belongs to different company |
| 404 | `"Project not found"` | No project row for given id |
| 422 | `"Both QuickBooks and Sage 300 CRE are connected. Only one ERP..."` | Multiple ERPs connected |
| 422 | `"No ERP integration is connected. Connect QuickBooks Online or Sage 300 CRE in Settings → Integrations first."` | Neither ERP connected |
| 500 | `"Failed to load project: {error}. If this mentions a missing column, apply supabase/migrations/163_project_qbo_customer_mapping.sql."` | DB error (usually missing migration 163) |

---

### 3.4 Settings Route (Integration Keys)

#### `PATCH /api/settings/company-integrations`

Writes integration configuration keys for the calling user's company.

**Auth:** Session; `super_admin` or `site_admin`.

**Request body:** Object with any subset of allowed integration keys. `QBO_BUDGET_CODE_MAP` is validated if present (see [Section 6](#6-budget-code-map-qbo_budget_code_map) for validation rules).

**Error responses:**

| HTTP | Body |
|---|---|
| 400 | Budget code map validation error strings (see [Section 11](#11-error-code-reference)) |
| 403 | Not super_admin/site_admin |

---

### 3.5 Cron Routes

Both crons are invoked by Vercel Cron and require `Authorization: Bearer {CRON_SECRET}`.

#### `GET /api/cron/quickbooks-sync`

**Schedule:** Daily at **17:00 UTC**.

**Behavior per QBO-connected company (resilient — one company failure does not stop others):**

1. **Dirty commitments:** Fetch up to 100 rows where `updated_at > last_synced_at OR last_synced_at IS NULL`; take first 25; sync each as Subcontract→Bill or PO→PurchaseOrder.
2. **Dirty prime contracts:** Same pattern, 25 cap; sync as Prime Contract→Invoice(AR).
3. **Dirty AP invoices:** Fetch up to 100 commitment SOV rows where `updated_at > qbo_ap_invoice_synced_at OR qbo_ap_invoice_synced_at IS NULL`; take 25; sync.
4. **Dirty AR invoices:** Same for prime contract SOV, using `qbo_ar_invoice_synced_at`.
5. **Payment refresh pass:** Fetch 25 stalest synced commitments by `qbo_payments_refreshed_at ASC` (nulls first); call `fetchQBOEntityFinancials` for each; update feedback columns and `qbo_payments_refreshed_at`.

**Response (200):** `{ "ok": true, "processed": { "commitments": N, "prime_contracts": N, ... } }`

---

#### `GET /api/cron/sage300cre-sync`

**Schedule:** Daily at **18:00 UTC** (1 hour after QBO cron).

**Behavior:** Identical pattern to QBO cron but for Sage 300 CRE connected companies, using `sage300cre_synced_at` / `sage300cre_ap_invoice_synced_at` / `sage300cre_ar_invoice_synced_at` / `sage300cre_payments_refreshed_at` columns.

---

## 4. Entity Crosswalk

### 4.1 QuickBooks Online

| SiteCommand Record | SiteCommand Type | QBO Entity | QBO Object Type | Notes |
|---|---|---|---|---|
| Commitment (Subcontract) | Payable | **Bill** | `Bill` | Vendor = Contract Company |
| Commitment (Purchase Order) | Payable | **Purchase Order** | `PurchaseOrder` | Vendor = Contract Company |
| Prime Contract | Receivable | **Invoice (AR)** | `Invoice` | Customer = Owner/Client |
| Commitment SOV billing (AP Invoice) | Payable invoice | **Bill** | `Bill` | SOV billed-to-date lines |
| Prime Contract SOV billing (AR Invoice) | Receivable invoice | **Invoice (AR)** | `Invoice` | SOV this-period lines |
| CCO (Subcontract parent) | Payable | **Bill** | `Bill` | DocNumber = `CO-{number}`; only Approved COs sync |
| CCO (Purchase Order parent) | Payable | **Purchase Order** | `PurchaseOrder` | DocNumber = `CO-{number}`; only Approved COs sync |
| PCCO (Prime Contract change order) | Receivable | **Invoice (AR)** | `Invoice` | DocNumber = `CO-{number}`; only Approved COs sync |

### 4.2 Sage 300 CRE (via Agave)

| SiteCommand Record | SiteCommand Type | Sage/Agave Entity | Agave Resource Path | Notes |
|---|---|---|---|---|
| Commitment (Subcontract or PO) | Payable | **Purchase Order** | `/purchase-orders` | Sage treats both commitment types as PO |
| Commitment SOV billing (AP Invoice) | Payable invoice | **AP Invoice** | `/ap-invoices` | Header `purchase_order_number` links back to PO |
| Prime Contract | Receivable | **AR Invoice** | `/ar-invoices` | Connector-dependent; may be unsupported |
| Prime Contract SOV billing (AR Invoice) | Receivable invoice | **AR Invoice** | `/ar-invoices` | SOV work-completed-this-period lines |
| CCO (Subcontract or PO parent) | Payable | **Purchase Order** | `/purchase-orders` | `number = CO-{number}`; only Approved COs sync |
| PCCO (Prime Contract change order) | Receivable | **AR Invoice** | `/ar-invoices` | `number = CO-{number}`; only Approved COs sync |

---

## 5. Field-Level Data Dictionary

**Legend:**
- **SC Field** — SiteCommand database column or derived value
- **ERP Field** — target field name in QBO JSON body or Agave payload
- **Type** — data type in the serialized payload
- **Rule** — transformation applied before sending
- **Req** — R = required to proceed (422 on absence); O = optional, omit key when null/blank

### 5.1 QBO: Subcontract → Bill

| SC Field | ERP Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` | string (QBO Id) | Resolve by display name via `findOrCreateVendorId`; auto-create enriched from `directory_contacts` (company/email/phone/fax/website/address) if not found. | **R** | 422 if blank: "This commitment has no Contract Company..." |
| `commitments.number` | `DocNumber` | string ≤21 chars | Apply `QBO_DOC_NUMBER_PREFIX` transform. `"project"` prefix = `{project.number}-{number}`; literal prefix = prepend string; unset = bare number. Cap at 21 chars total. | O | |
| `commitments.title` | `PrivateNote` | string | Direct copy. | O | |
| `commitments.start_date` | `TxnDate` | YYYY-MM-DD | Direct. Fallback: today's date if null. | O | |
| `commitments.estimated_completion_date` | `DueDate` | YYYY-MM-DD | Direct. | O | Omit key entirely if null. |
| `commitments.payment_terms` | `SalesTermRef` | object `{value: Id}` | Resolve by exact active-Term name match against QBO Terms list. On match: `{value: Id}`. No match: append raw value to `PrivateNote` instead. | O | |
| SOV line `description` | `Line[n].Description` | string | One Line per SOV item where `billed_to_date > 0`. | O | |
| SOV line `billed_to_date` | `Line[n].Amount` | number | `toFixed(2)`. Only lines with `billed_to_date > 0`. | O | |
| SOV line `quantity` + `unit_cost` | `Line[n].Qty` + `Line[n].UnitPrice` | number | Included when `Math.abs(qty * unit_cost - billed_to_date) < 0.01`. | O | |
| SOV line `budget_code` | `Line[n].AccountRef` | object `{value: Id}` | Map via `QBO_BUDGET_CODE_MAP[code].account` → QBO account Id. Fallback: `QBO_AP_EXPENSE_ACCOUNT` resolved account. | O | |
| Project name | `Line[n].ClassRef` | object `{value: Id}` | Auto-create QBO Class named after project. Disabled when `QBO_PROJECT_TRACKING = "none"`. | O | |
| `commitments.default_retainage` | Additional negative `Line` | number | Amount = `-(billed_to_date_total × retainage_pct / 100)`. Posted to `QBO_RETAINAGE_PAYABLE_ACCOUNT`. | O | Omit entire retainage line when pct = 0 or `QBO_RETAINAGE_PAYABLE_ACCOUNT` is unset. |
| Revised contract amount | `Line[0].Amount` (lump sum fallback) | number | `original_contract_amount + sum(approved CO amounts)`. Used only when SOV has no lines. | O | Lump-sum fallback path only. |
| `status = "void"` or `"terminated"` | DELETE Bill | — | Send QBO DELETE `Bill/{qbo_id}`. Set `action = "deleted"`; clear `qbo_id` and `qbo_sync_token` and feedback columns. | — | |

---

### 5.2 QBO: Purchase Order → PurchaseOrder

| SC Field | ERP Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` | string (QBO Id) | Same vendor resolution as Bill. | **R** | 422 if blank. |
| `commitments.number` | `DocNumber` | string ≤21 chars | Same prefix logic as Bill. | O | |
| `commitments.title` | `PrivateNote` and `Line[0].Description` | string | Written to both fields. | O | |
| `commitments.issued_on_date` or `commitments.contract_date` | `TxnDate` | YYYY-MM-DD | Use `issued_on_date` first; fallback to `contract_date`; fallback to today. | O | |
| `commitments.delivery_date` | `DueDate` | YYYY-MM-DD | Direct. | O | Omit if null. |
| `commitments.ship_to` | `ShipAddr` | object | Map to `ShipAddr.Line1` through `Line5` from address fields. | O | |
| `commitments.ship_via` | `PrivateNote` (appended) | string | Appended as `"Ship Via: {value}"`. | O | |
| `commitments.bill_to` | `PrivateNote` (appended) | string | Appended as `"Bill To: {value}"`. | O | |
| `commitments.payment_terms` | `SalesTermRef` | object | Same Term resolution logic as Bill. | O | |
| SOV lines | `Line[n]` with `ItemBasedExpenseLineDetail` | — | One Line per SOV item. `ItemRef` resolved from `QBO_BUDGET_CODE_MAP[code].item` or `QBO_DEFAULT_ITEM`. ClassRef from project. | O | |
| `status = "void"` | `POStatus = "Closed"` | string | PATCH the PO with `POStatus = "Closed"`. Not deleted. `action = "closed"`. | — | |

---

### 5.3 QBO: Prime Contract → Invoice (AR)

| SC Field | ERP Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `prime_contracts.owner_client` | `CustomerRef.value` | string (QBO Id) | Resolve/auto-create via `findOrCreateCustomerId`. Resolution order: `projects.qbo_customer_id` (migration 163 override, checked first) → QBO Projects (IsProject=true, name match) → sub-customers with `:<name>` suffix → plain Customers by name. | **R** | 422 if blank: "This prime contract has no Owner/Client..." |
| `prime_contracts.contract_number` | `DocNumber` | string ≤21 chars | Same prefix logic. | O | |
| `prime_contracts.start_date` | `TxnDate` | YYYY-MM-DD | Direct. Fallback: today. | O | |
| `prime_contracts.estimated_completion_date` | `DueDate` | YYYY-MM-DD | Direct. | O | Omit if null. |
| `prime_contracts.title` | `Line[0].Description` | string | Direct. | O | |
| `prime_contracts.description` or `title` | `CustomerMemo.value` | string | Use `description` if present; fallback to `title`. | O | |
| description, contractor, architect_engineer, default_retainage, executed, status | `PrivateNote` | string | Multi-line concatenation of `"key: value"` pairs. | O | |
| Revised contract amount | `Line[0].Amount` / `UnitPrice` (Qty=1) | number | `original_contract_amount + sum(approved CO amounts)`. Lump sum fallback when SOV is empty. | O | |
| SOV lines | `Line[n]` `SalesItemLineDetail` | — | One Line per SOV item. ItemRef from `QBO_BUDGET_CODE_MAP.item` or `QBO_DEFAULT_ITEM`. ClassRef from project. | O | |
| `prime_contracts.default_retainage` | Negative line using `"Retainage"` item | number | Amount = `-(revised_amount × retainage_pct / 100)`. Posted to `QBO_RETAINAGE_RECEIVABLE_ACCOUNT`. Auto-create/resolve `"Retainage"` QBO Item if absent. | O | Omit when pct = 0 or `QBO_RETAINAGE_RECEIVABLE_ACCOUNT` is unset. |
| `prime_contracts.materials_stored` | Dedicated line | number | Description: `"Materials presently stored"`. Amount direct. | O | Omit when 0 or null. |
| `status = "void"` | Void Invoice | — | `POST Invoice/{qbo_id}/void`. `action = "voided"`. Clear feedback columns. | — | |

---

### 5.4 QBO: AP Invoice (Commitment SOV billed-to-date) → Bill

This is a separate sync from the commitment header itself. It represents the subcontractor's draw request derived from SOV `billed_to_date` values.

| SC Field | ERP Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` | string (QBO Id) | Same vendor resolution. | **R** | |
| `commitments.number` | `DocNumber` | string ≤21 chars | Same prefix logic. | O | |
| `commitments.title` | `PrivateNote` | string | Direct. | O | |
| SOV `description` | `Line[n].Description` | string | Lines where `billed_to_date > 0`. | O | |
| SOV `billed_to_date` | `Line[n].Amount` | number | `toFixed(2)`. | O | |
| SOV `quantity`, `unit_of_measure`, `unit_cost` | `Line[n].Qty`, `UnitPrice` | number | Included when `qty × unit_cost ≈ billed_to_date`. | O | |
| SOV `budget_code` | `Line[n].AccountRef` / `ClassRef` | object | Via `QBO_BUDGET_CODE_MAP`; fallback expense account. | O | |
| `commitments.default_retainage` | Negative retainage line | number | Same calculation and account as commitment Bill. | O | |

---

### 5.5 QBO: AR Invoice (Prime Contract SOV this-period) → Invoice (AR)

| SC Field | ERP Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `prime_contracts.owner_client` | `CustomerRef.value` | string (QBO Id) | Same customer resolution with `projects.qbo_customer_id` override. | **R** | |
| `prime_contracts.contract_number` | `DocNumber` | string ≤21 chars | Same prefix logic. | O | |
| `prime_contracts.title` | `PrivateNote` | string | Direct. | O | |
| SOV `description` | `Line[n].Description` | string | Lines where `work_completed_this_period > 0`. | O | |
| SOV `work_completed_this_period` | `Line[n].Amount` / `UnitPrice` | number | `toFixed(2)`. | O | |
| SOV `budget_code` | `Line[n].ClassRef` / `ItemRef` | object | Via `QBO_BUDGET_CODE_MAP`. | O | |
| SOV per-line retainage | Rolled-up negative retainage line | number | Sum all per-line retainage amounts into one negative line. | O | |
| SOV `materials_stored` | `"Materials presently stored"` line | number | Dedicated line. | O | Omit when 0 or null. |

---

### 5.6 Sage 300 CRE: Commitment → Purchase Order

| SC Field | Agave Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `vendor_id` | string (Agave Id) | `GET /vendors`; match by exact name. **No auto-create.** Fail-fast with 422 if not found. | **R** | Sage is the system of record for vendors. Error: "Vendor '{name}' was not found..." |
| `commitments.number` | `number` / `doc_number` | string | Direct. | O | |
| `commitments.title` | `description` | string | Direct. | O | |
| Revised amount | `amount` | number | `(original_contract_amount + approved CO total).toFixed(2)`. | O | |
| `commitments.delivery_date` or `commitments.estimated_completion_date` | `due_date` | YYYY-MM-DD | Use `delivery_date` first; fallback to `estimated_completion_date`. | O | Omit if both null. |
| Project `number` / `name` | `job_id` | string (Agave Id) | `GET /jobs`; match by `project.number` first, then `project.name`. Omit field if unresolved. Jobs are never auto-created. | O | |
| SOV `budget_code` | `cost_code_id` per line | string (Agave Id) | `GET /cost-codes?job_id={id}`; exact code match, then name match. Omit per line if unresolved; code folded into line description instead. | O | |
| SOV `description` | Line description | string | `"{budget_code} — {description}"` when cost_code_id unresolved; bare `description` otherwise. | O | |
| SOV `quantity` × `unit_cost` consistent | `quantity` / `unit_cost` / `unit_of_measure` | number | Included when `qty × unit_cost ≈ line_amount`. | O | |

---

### 5.7 Sage 300 CRE: AP Invoice (Commitment SOV billed-to-date) → AP Invoice

| SC Field | Agave Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `vendor_id` | string (Agave Id) | Same resolution as PO. | **R** | |
| `commitments.number` | `purchase_order_number` | string | Direct. Links AP Invoice to the Sage PO. | O | |
| SOV `billed_to_date` > 0 | Invoice line `amount` | number | `toFixed(2)`. One line per SOV item with `billed_to_date > 0`. | O | |
| SOV `budget_code` | `cost_code_id` per line | string | Same Agave cost-code resolution. | O | |
| Project | `job_id` | string | Same job resolution. | O | |
| `commitments.default_retainage` | `retention_amount` (header-level) | number | `sum(billed_to_date) × retainage_pct / 100`. Single header field, not per-line. | O | |
| SOV `quantity` / `unit_cost` / `unit_of_measure` | `quantity` / `unit_cost` / `unit_of_measure` | number | When `qty × unit_cost ≈ line_amount`. | O | |

---

### 5.8 Sage 300 CRE: Prime Contract → AR Invoice

| SC Field | Agave Field | Type | Rule | Req | Notes |
|---|---|---|---|---|---|
| `prime_contracts.owner_client` | `customer_id` | string (Agave Id) | `GET /customers`; exact name match. No auto-create. Fail-fast with 422 if not found. | **R** | Error: "Customer '{name}' was not found..." |
| `prime_contracts.contract_number` | `number` | string | Direct. | O | |
| `prime_contracts.title` | `description` | string | Direct. | O | |
| Revised amount | `amount` | number | `toFixed(2)`. | O | |
| `prime_contracts.estimated_completion_date` | `due_date` | YYYY-MM-DD | Direct. | O | Omit if null. |
| Project | `job_id` | string | Same job resolution. | O | |
| SOV `work_completed_this_period` > 0 | Invoice lines | number | Per-line amounts. | O | |
| SOV per-line retainage | `retention_amount` (header-level, rolled up) | number | Sum all per-line retainage; one header field. | O | |
| AR support | — | — | Connector-dependent. Agave surfaces an error in `erp_sync_logs` if the connector for this Sage instance does not support `/ar-invoices`. | — | Not all Agave Sage connectors expose AR invoices. |

---

## 6. Budget Code Map (QBO_BUDGET_CODE_MAP)

### Schema

`QBO_BUDGET_CODE_MAP` is a JSON object stored in `company_integrations`. Each key is a SiteCommand budget code string; each value is a mapping object.

```jsonc
{
  "<budget_code>": {
    "item"?: "<QBO Item Name or Id>",      // Recommended. QBO Products & Services item.
    "account"?: "<QBO Account Display Name>", // Legacy. QBO Expense/COGS account.
    "class"?: "<QBO Class Name>"            // Optional. Overrides auto-derived project class for this code.
  }
}
```

**Constraint:** Each entry must set at least one of `item` or `account`. A `class`-only entry passes validation but will fail at sync time because neither an account nor an item is available to post the line.

### Validation Rules (enforced by `PATCH /api/settings/company-integrations`)

| Rule | Error message returned |
|---|---|
| Value must be valid JSON | `"Budget code map must be valid JSON."` |
| Top-level must be a plain object | `"Budget code map must be a JSON object keyed by budget code."` |
| No blank string keys | `"Budget codes cannot be blank."` |
| Each value must be a plain object | `"Entry for \"{code}\" must be an object."` |
| Each field (item/account/class) must be string type | `"\"{code}\".{field} must be a string."` |

### Items-Based Resolution (Recommended)

Used when `QBO_BUDGET_CODE_MAP[code].item` is set.

1. Look up item name in the QBO Items list (from `fetchQBOItems` — active Products & Services).
2. If found → use `ItemRef.value = {Id}`.
3. If not found → auto-create in QBO with `type: "Service"` and the given name.
4. Each push line uses the resolved ItemRef.
5. At budget resync pull time: QBO P&L Detail report is grouped by `item_name`; totals attributed back via reverse-map of `QBO_BUDGET_CODE_MAP`.
6. When a single QBO Item maps to more than one budget code in the map → **both codes are skipped** (ambiguous; no cost attributed to either).

**Project/Customer resolution for P&L scoping:**
- Check `projects.qbo_customer_id` first (set via Project Admin → ERP Integration picker, migration 163).
- Fallback: `findCustomerIdByName` — search QBO Projects (`IsProject = true`) first, then sub-customers with `:<name>` suffix, then plain Customers by display name.
- P&L report call: `GET reports/ProfitAndLossDetail?customer={id}&accounting_method=Accrual&columns=tx_date,name,memo,item_name,subt_nat_amount&minorversion=65`.

### Account-Based Resolution (Legacy)

Used when `QBO_BUDGET_CODE_MAP[code].account` is set and `item` is not set.

1. Resolve account display name → QBO Account Id via `fetchQBOAccounts`.
2. Resolve project Class via `findClassIdByName` (read-only; Classes are NOT created in this path).
3. If no matching Class found → return empty result for affected codes with a warning. **Never** fall back to company-wide totals.
4. P&L summary call: `GET reports/ProfitAndLoss?classid={classId}&accounting_method=Accrual&minorversion=65`.
5. Sum leaf account row amounts; attribute totals back to codes mapped to each account.

Both paths can coexist within the same resync call. Each budget code uses the path determined by which fields are set in its map entry.

### Example

```json
{
  "02-310.C": {
    "item": "02-310.C"
  },
  "03-100.L": {
    "account": "Concrete Labor",
    "class": "Riverside Tower"
  },
  "05-500.M": {
    "item": "Structural Steel",
    "account": "Steel Materials"
  }
}
```

In the third entry, `item` takes precedence at sync time (items-based path). The `account` field is present but unused during sync; it could be referenced by legacy tooling.

---

## 7. Pull Direction — ERP → Budget

The **Resync with ERP** button in the Budget tool calls `POST /api/integrations/erp/resync-budget`. This section documents what each ERP path does to produce the job-to-date cost values written to `budget_line_items.job_to_date_costs`.

### 7.1 QBO — Items-Based Pull

**Function:** `fetchQBOJobToDateCosts` → `pullByItem` in `lib/quickbooks.ts`.

**Steps:**

1. Resolve project to QBO Customer/Project Id:
   - Check `projects.qbo_customer_id` (migration 163 override).
   - Fallback: `findCustomerIdByName` — QBO Projects (IsProject=true) by name, then sub-customers, then plain Customers.
2. Call: `GET reports/ProfitAndLossDetail?customer={id}&accounting_method=Accrual&columns=tx_date,name,memo,item_name,subt_nat_amount&minorversion=65`.
3. Walk all leaf rows; group by `item_name`; sum `subt_nat_amount` per item.
4. For each budget code with `item` in map:
   - Find item name in totals map.
   - If the item maps to exactly one budget code → attribute sum to that code.
   - If the item maps to more than one code → skip (ambiguous).
5. Return `Map<budget_code, amount>`.

### 7.2 QBO — Account-Based Pull

**Function:** `fetchQBOJobToDateCosts` → `pullByAccount` in `lib/quickbooks.ts`.

**Steps:**

1. Resolve project Class via `findClassIdByName` (read-only).
2. If no Class found → return empty result + warning for this code.
3. Call: `GET reports/ProfitAndLoss?classid={classId}&accounting_method=Accrual&minorversion=65`.
4. Sum each leaf account row's `subt_nat_amount`.
5. Attribute account total to each budget code whose map entry references that account.
6. Return `Map<budget_code, amount>`.

### 7.3 Sage 300 CRE Pull

**Function:** `fetchSage300CreJobToDateCosts` in `lib/sage300cre.ts`.

**Steps:**

1. Resolve project to Sage job via `resolveSage300CreJobId`:
   - `GET /jobs`; match by `project.number` first, then `project.name`.
   - If no match → return empty result with warning; no costs attributed.
2. `GET /cost-codes?job_id={jobId}` — list all cost codes recorded for the job.
3. For each cost code row, read the actual cost field. Field name is connector-dependent; code probes in order: `actual_cost`, `actual_amount`, `cost_to_date`, and other common variants.
4. Match Sage cost code → SiteCommand budget code: exact code string match first, then name match.
5. Unmatched Sage cost codes are skipped silently.
6. Return `Map<budget_code, amount>`.

### 7.4 Write-Back

After either pull returns a result map:

```sql
UPDATE budget_line_items
SET job_to_date_costs = $amount
WHERE project_id = $projectId
  AND cost_code = $budgetCode;
```

One `erp_sync_logs` row is written per `resync-budget` call (not per budget code) with `record_type = 'budget_job_to_date'`, `integration = 'quickbooks'` or `'sage300cre'`.

---

## 8. Accounting Feedback Schema

After every push sync, the sync code parses the ERP response and writes accounting feedback back to the SiteCommand record. This data powers the **Accounting** section on commitment and prime contract detail pages and the **Refresh payment status** button.

### 8.1 Commitments — QBO Feedback Columns

| Column | Type | Source in QBO Response | Description |
|---|---|---|---|
| `qbo_vendor_id` | TEXT | `VendorRef.value` from Bill/PO response | QBO Id of the resolved or auto-created vendor. |
| `qbo_total_amount` | NUMERIC(15,2) | `TotalAmt` | Total amount of the Bill or PO as recorded in QBO. |
| `qbo_balance` | NUMERIC(15,2) | `Balance` | Unpaid balance on the Bill. `0` for POs (non-posting documents). |
| `qbo_payment_status` | TEXT | Derived | `"paid"` when `Balance = 0`; `"partially_paid"` when `0 < Balance < TotalAmt`; `"unpaid"` when `Balance = TotalAmt`. For POs: lowercased `POStatus` value (e.g. `"open"`, `"closed"`). |
| `qbo_ap_invoice_total_amount` | NUMERIC(15,2) | `TotalAmt` from AP Invoice Bill | Total of the AP Invoice Bill. |
| `qbo_ap_invoice_balance` | NUMERIC(15,2) | `Balance` from AP Invoice Bill | Unpaid balance on AP Invoice Bill. |
| `qbo_ap_invoice_payment_status` | TEXT | Derived same as above | Payment status of the AP Invoice. |
| `qbo_payments_refreshed_at` | TIMESTAMPTZ | Set on every refresh call | Timestamp of last payment status read (cron or manual). |

### 8.2 Commitments — Sage 300 CRE Feedback Columns

| Column | Type | Source in Agave Response | Description |
|---|---|---|---|
| `sage300cre_vendor_id` | TEXT | Resolved vendor Id | Agave entity Id of the resolved Sage vendor. |
| `sage300cre_status` | TEXT | `status` from PO response | Purchase Order status as returned by Sage via Agave (connector-dependent values, e.g. `"Open"`, `"Closed"`). |
| `sage300cre_ap_invoice_total_amount` | NUMERIC(15,2) | `amount` from AP Invoice response | Total of the AP Invoice. |
| `sage300cre_ap_invoice_amount_paid` | NUMERIC(15,2) | `amount_paid` | Amount paid against the AP Invoice. |
| `sage300cre_ap_invoice_balance` | NUMERIC(15,2) | `balance` | Unpaid balance. |
| `sage300cre_ap_invoice_status` | TEXT | `status` | Sage AP Invoice status. |
| `sage300cre_payments_refreshed_at` | TIMESTAMPTZ | Set on every refresh call | Timestamp of last payment status read. |

### 8.3 Prime Contracts — QBO Feedback Columns

| Column | Type | Source in QBO Response | Description |
|---|---|---|---|
| `qbo_customer_id` | TEXT | `CustomerRef.value` from Invoice response | QBO Id of the resolved or auto-created customer. |
| `qbo_total_amount` | NUMERIC(15,2) | `TotalAmt` | Total amount of the AR Invoice. |
| `qbo_balance` | NUMERIC(15,2) | `Balance` | Unpaid balance. |
| `qbo_payment_status` | TEXT | Derived | Same derivation as commitments. |
| `qbo_ar_invoice_total_amount` | NUMERIC(15,2) | `TotalAmt` from AR Invoice (SOV billing) | Total of the AR Invoice billing record. |
| `qbo_ar_invoice_balance` | NUMERIC(15,2) | `Balance` from AR Invoice | Unpaid balance on the AR Invoice. |
| `qbo_ar_invoice_payment_status` | TEXT | Derived | Payment status of the AR Invoice. |
| `qbo_payments_refreshed_at` | TIMESTAMPTZ | Set on refresh | Timestamp of last payment status read. |

### 8.4 Prime Contracts — Sage 300 CRE Feedback Columns

| Column | Type | Source in Agave Response | Description |
|---|---|---|---|
| `sage300cre_customer_id` | TEXT | Resolved customer Id | Agave entity Id of the resolved Sage customer. |
| `sage300cre_total_amount` | NUMERIC(15,2) | `amount` from AR Invoice | Total contract/AR amount. |
| `sage300cre_amount_paid` | NUMERIC(15,2) | `amount_paid` | Amount paid. |
| `sage300cre_balance` | NUMERIC(15,2) | `balance` | Unpaid balance. |
| `sage300cre_status` | TEXT | `status` | Sage AR Invoice status. |
| `sage300cre_ar_invoice_total_amount` | NUMERIC(15,2) | `amount` from billing AR Invoice | Total of the SOV-billing AR Invoice. |
| `sage300cre_ar_invoice_amount_paid` | NUMERIC(15,2) | `amount_paid` | Amount paid on the billing invoice. |
| `sage300cre_ar_invoice_balance` | NUMERIC(15,2) | `balance` | Unpaid balance on the billing invoice. |
| `sage300cre_ar_invoice_status` | TEXT | `status` | Status of the billing AR Invoice. |
| `sage300cre_payments_refreshed_at` | TIMESTAMPTZ | Set on refresh | Timestamp of last payment status read. |

### 8.5 Parsing Behavior

**Agave responses** may wrap data in a `data` key or return fields at the top level. The sync code probes both:

```js
const amount = response.data?.amount ?? response.amount;
```

**QBO responses** use top-level fields directly: `TotalAmt`, `Balance`, `POStatus`.

**On delete/skip/void:** The sync route clears `qbo_id` / `sage300cre_id` **and** all corresponding feedback columns (total_amount, balance, payment_status, etc.) so the cron does not retry the record unnecessarily.

---

## 9. Idempotency & Sync State

### 9.1 QBO Tracking Columns (Migration 113)

#### `commitments` table

| Column | Type | Nullable | Purpose | Update Protocol |
|---|---|---|---|---|
| `qbo_id` | TEXT | NULL | QBO entity Id (Bill or PurchaseOrder) for the commitment. | Set on create; retained on update; cleared on delete/skip. |
| `qbo_sync_token` | TEXT | NULL | QBO SyncToken required for update operations. | Re-fetched from QBO immediately before every UPDATE request. |
| `last_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection timestamp for the main commitment sync. | Set to `now()` after every successful push. |
| `qbo_ap_invoice_id` | TEXT | NULL | QBO Bill Id for the AP Invoice (SOV billing). | Set on create; cleared on delete/skip. |
| `qbo_ap_invoice_sync_token` | TEXT | NULL | SyncToken for the AP Invoice Bill. | Re-fetched before every update. |
| `qbo_ap_invoice_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for AP Invoice sync. | Set to `now()` after successful AP Invoice push. |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | — | Triggers cron dirty detection. | Auto-updated by DB `BEFORE UPDATE` trigger on any change to the row. |

#### `prime_contracts` table

| Column | Type | Nullable | Purpose | Update Protocol |
|---|---|---|---|---|
| `qbo_id` | TEXT | NULL | QBO Invoice Id for the prime contract header. | Set/cleared same pattern as commitment. |
| `qbo_sync_token` | TEXT | NULL | QBO SyncToken for the Invoice. | Re-fetched before every update. |
| `last_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for main contract sync. | Set after successful push. |
| `qbo_ar_invoice_id` | TEXT | NULL | QBO Invoice Id for the AR Invoice (SOV billing). | Set/cleared same pattern. |
| `qbo_ar_invoice_sync_token` | TEXT | NULL | SyncToken for the AR Invoice. | Re-fetched before every update. |
| `qbo_ar_invoice_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for AR Invoice sync. | Set after successful AR Invoice push. |

#### `commitment_sov_items` table

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | — | Dirty-detection for AP Invoice sync: cron compares `sov.updated_at > commitments.qbo_ap_invoice_synced_at`. |

---

### 9.2 Sage 300 CRE Tracking Columns (Migration 160)

#### `commitments` table

| Column | Type | Nullable | Purpose | Update Protocol |
|---|---|---|---|---|
| `sage300cre_id` | TEXT | NULL | Agave PO entity Id. | Set on create; retained on update. |
| `sage300cre_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for main commitment sync. | Set after successful push. |
| `sage300cre_ap_invoice_id` | TEXT | NULL | Agave AP Invoice entity Id. | Set on create. |
| `sage300cre_ap_invoice_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for AP Invoice sync. | Set after successful push. |

#### `prime_contracts` table

| Column | Type | Nullable | Purpose | Update Protocol |
|---|---|---|---|---|
| `sage300cre_id` | TEXT | NULL | Agave AR Invoice entity Id for the contract header. | Set on create. |
| `sage300cre_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for main contract sync. | Set after successful push. |
| `sage300cre_ar_invoice_id` | TEXT | NULL | Agave AR Invoice entity Id for SOV billing. | Set on create. |
| `sage300cre_ar_invoice_synced_at` | TIMESTAMPTZ | NULL | Dirty-detection for AR Invoice sync. | Set after successful push. |

---

### 9.3 Update Protocol

**QBO update flow:**
1. Check if `qbo_id` is set. If null → send `POST` to create new entity.
2. If `qbo_id` set → `GET {entity}/{qbo_id}?minorversion=65` to retrieve current `SyncToken`.
3. If QBO returns 404 (entity was deleted on QBO side) → fall back to `POST` to re-create.
4. Send `POST {entity}?operation=update&sparse=true&minorversion=65` with `{ Id: qbo_id, SyncToken: freshToken, ...payload }`.
5. On success: update `qbo_id`, `qbo_sync_token`, `last_synced_at`, and feedback columns.

**Sage update flow:**
1. Check if `sage300cre_id` is set. If null → `POST /{resource}`.
2. If set → `PUT /{resource}/{sage300cre_id}`. Agave has no SyncToken concept.
3. If Agave returns 404 → fall back to `POST` to re-create.
4. On success: update `sage300cre_id`, `sage300cre_synced_at`, and feedback columns.

---

### 9.4 Cron Dirty Detection

Both crons use the same fetch-then-filter pattern:

```sql
-- Fetch 100, take first 25 after filtering in application code
SELECT * FROM commitments
WHERE company_id = $companyId
  AND (last_synced_at IS NULL OR updated_at > last_synced_at)
ORDER BY updated_at ASC
LIMIT 100;
```

Application code filters the 100 rows to confirmed-dirty candidates and takes the first 25. The 4× buffer handles records that fail repeatedly (their `updated_at` keeps advancing past `last_synced_at`).

---

### 9.5 Per-Project QBO Customer Override (Migration 163)

| Column | Table | Type | Nullable | Purpose |
|---|---|---|---|---|
| `qbo_customer_id` | `projects` | TEXT | NULL | Pinned QBO Customer/Project Id. Set in Project Admin → ERP Integration → QuickBooks Project/Customer picker. Takes precedence over all name-based lookups in push and pull operations. |
| `qbo_customer_name` | `projects` | TEXT | NULL | Display name of the pinned customer. Stored for UI display only. |

---

## 10. Database Schema Reference

### 10.1 `erp_sync_logs` Table

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Primary key. |
| `record_type` | TEXT | NOT NULL | — | SiteCommand record type: `"commitments"`, `"prime_contracts"`, `"ap_invoice"`, `"ar_invoice"`, `"budget_job_to_date"`. |
| `record_id` | UUID | NOT NULL | — | Id of the SiteCommand record being synced. For `"budget_job_to_date"`, this is the `project_id`. |
| `integration` | TEXT | NOT NULL | — | `"quickbooks"` or `"sage300cre"`. |
| `result` | TEXT | NOT NULL | — | `"success"` or `"error"`. |
| `sage_key` | TEXT | NULL | NULL | ERP document identifier on success (e.g. `"Bill:123"`, `"PurchaseOrder:456"`). Null on error. |
| `error_message` | TEXT | NULL | NULL | Human-readable error description on failure. Null on success. |
| `raw_response` | TEXT | NULL | NULL | Truncated raw ERP response body, max 8,000 characters. Used for debugging. |
| `synced_at` | TIMESTAMPTZ | NOT NULL | `now()` | Timestamp of the sync attempt. |

**Index:** `(record_type, record_id, synced_at DESC)` — supports efficient per-record log queries sorted newest-first.

---

### 10.2 Migration 113 — QBO Idempotency Columns

**File:** `supabase/migrations/113_qbo_idempotency_columns.sql`

**Columns added to `commitments`:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `qbo_id` | TEXT | NULL | NULL |
| `qbo_sync_token` | TEXT | NULL | NULL |
| `last_synced_at` | TIMESTAMPTZ | NULL | NULL |
| `qbo_ap_invoice_id` | TEXT | NULL | NULL |
| `qbo_ap_invoice_sync_token` | TEXT | NULL | NULL |
| `qbo_ap_invoice_synced_at` | TIMESTAMPTZ | NULL | NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` |

Also adds a `BEFORE UPDATE` trigger on `commitments` setting `updated_at = NOW()`.

**Columns added to `prime_contracts`:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `qbo_id` | TEXT | NULL | NULL |
| `qbo_sync_token` | TEXT | NULL | NULL |
| `last_synced_at` | TIMESTAMPTZ | NULL | NULL |
| `qbo_ar_invoice_id` | TEXT | NULL | NULL |
| `qbo_ar_invoice_sync_token` | TEXT | NULL | NULL |
| `qbo_ar_invoice_synced_at` | TIMESTAMPTZ | NULL | NULL |

**Columns added to `commitment_sov_items`:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` |

---

### 10.3 Migration 160 — Sage 300 CRE Idempotency Columns

**File:** `supabase/migrations/160_sage300cre_idempotency_columns.sql`

**Columns added to `commitments`:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `sage300cre_id` | TEXT | NULL | NULL |
| `sage300cre_synced_at` | TIMESTAMPTZ | NULL | NULL |
| `sage300cre_ap_invoice_id` | TEXT | NULL | NULL |
| `sage300cre_ap_invoice_synced_at` | TIMESTAMPTZ | NULL | NULL |

**Columns added to `prime_contracts`:**

| Column | Type | Nullable | Default |
|---|---|---|---|
| `sage300cre_id` | TEXT | NULL | NULL |
| `sage300cre_synced_at` | TIMESTAMPTZ | NULL | NULL |
| `sage300cre_ar_invoice_id` | TEXT | NULL | NULL |
| `sage300cre_ar_invoice_synced_at` | TIMESTAMPTZ | NULL | NULL |

---

### 10.4 Migration 161 — ERP Accounting Feedback Columns

**File:** `supabase/migrations/161_erp_accounting_feedback_columns.sql`

**Columns added to `commitments`:**

| Column | Type | Nullable |
|---|---|---|
| `qbo_vendor_id` | TEXT | NULL |
| `qbo_total_amount` | NUMERIC(15,2) | NULL |
| `qbo_balance` | NUMERIC(15,2) | NULL |
| `qbo_payment_status` | TEXT | NULL |
| `qbo_ap_invoice_total_amount` | NUMERIC(15,2) | NULL |
| `qbo_ap_invoice_balance` | NUMERIC(15,2) | NULL |
| `qbo_ap_invoice_payment_status` | TEXT | NULL |
| `qbo_payments_refreshed_at` | TIMESTAMPTZ | NULL |
| `sage300cre_vendor_id` | TEXT | NULL |
| `sage300cre_status` | TEXT | NULL |
| `sage300cre_ap_invoice_total_amount` | NUMERIC(15,2) | NULL |
| `sage300cre_ap_invoice_amount_paid` | NUMERIC(15,2) | NULL |
| `sage300cre_ap_invoice_balance` | NUMERIC(15,2) | NULL |
| `sage300cre_ap_invoice_status` | TEXT | NULL |
| `sage300cre_payments_refreshed_at` | TIMESTAMPTZ | NULL |

**Columns added to `prime_contracts`:**

| Column | Type | Nullable |
|---|---|---|
| `qbo_customer_id` | TEXT | NULL |
| `qbo_total_amount` | NUMERIC(15,2) | NULL |
| `qbo_balance` | NUMERIC(15,2) | NULL |
| `qbo_payment_status` | TEXT | NULL |
| `qbo_ar_invoice_total_amount` | NUMERIC(15,2) | NULL |
| `qbo_ar_invoice_balance` | NUMERIC(15,2) | NULL |
| `qbo_ar_invoice_payment_status` | TEXT | NULL |
| `qbo_payments_refreshed_at` | TIMESTAMPTZ | NULL |
| `sage300cre_customer_id` | TEXT | NULL |
| `sage300cre_total_amount` | NUMERIC(15,2) | NULL |
| `sage300cre_amount_paid` | NUMERIC(15,2) | NULL |
| `sage300cre_balance` | NUMERIC(15,2) | NULL |
| `sage300cre_status` | TEXT | NULL |
| `sage300cre_ar_invoice_total_amount` | NUMERIC(15,2) | NULL |
| `sage300cre_ar_invoice_amount_paid` | NUMERIC(15,2) | NULL |
| `sage300cre_ar_invoice_balance` | NUMERIC(15,2) | NULL |
| `sage300cre_ar_invoice_status` | TEXT | NULL |
| `sage300cre_payments_refreshed_at` | TIMESTAMPTZ | NULL |

---

### 10.5 Migration 163 — Per-Project QBO Customer Mapping

**File:** `supabase/migrations/163_project_qbo_customer_mapping.sql`

**Columns added to `projects`:**

| Column | Type | Nullable | Description |
|---|---|---|---|
| `qbo_customer_id` | TEXT | NULL | Pinned QBO Customer/Project Id for this SiteCommand project. Used as primary customer lookup in all QBO push and pull operations when set. |
| `qbo_customer_name` | TEXT | NULL | Display name of the pinned QBO Customer/Project. Stored for UI label only. |

**Note:** If the `resync-budget` route returns HTTP 500 with a message mentioning a missing column, this migration has not been applied to the target environment.

---

## 11. Error Code Reference

### 11.1 QBO OAuth Errors

All redirect the browser to `/settings/integrations?error={code}` (and optionally `&reason={detail}`).

| Error Code | HTTP Equivalent | Trigger | Resolution |
|---|---|---|---|
| `qbo_unauthorized` | 401 | No valid session on the connect route. | User must be logged in. |
| `qbo_forbidden` | 403 | Role is not `super_admin` or `site_admin`. | User needs Super Admin role. |
| `qbo_no_company` | 422 | Session exists but has no `company_id`. | Account setup issue; contact support. |
| `qbo_not_configured` | — | `QBO_CLIENT_ID` missing from all config sources. | Add `QBO_CLIENT_ID` and `QBO_CLIENT_SECRET` to `company_integrations` or env. |
| `qbo_other_erp_connected` | 422 | `SAGE300CRE_ACCOUNT_TOKEN` present for the company. | Disconnect Sage 300 CRE in Settings → Integrations first. |
| `qbo_denied` | — | User clicked Cancel on Intuit consent. `reason=` contains Intuit's `error` param. | No action needed; user can re-attempt. |
| `qbo_invalid_callback` | — | `code`, `realmId`, or `state` missing from callback query params. | Retry OAuth from the connect button; may indicate a proxy or redirect misconfiguration. |
| `qbo_invalid_state` | — | CSRF nonce mismatch between state param and `qbo_oauth_state` cookie. | Cookie may have expired (10-min TTL) or been cleared. Retry from connect. |
| `qbo_missing_app_creds` | — | Client ID/Secret missing at callback time (removed after connect was initiated). | Restore `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`. |
| `qbo_token_exchange_failed` | — | Intuit's token endpoint returned non-200. `reason=` contains the response body. | Check Intuit Developer status page; verify app credentials; verify redirect URI matches portal registration. |

---

### 11.2 QBO Sync Validation Errors (HTTP 422)

These have `validation: true` in the JSON error body, indicating a data problem rather than a QBO connectivity problem.

| Error Message | Trigger | Resolution |
|---|---|---|
| `"This commitment has no Contract Company, and QuickBooks requires a vendor on every Bill. Edit the commitment, set the Contract Company, then sync again."` | `commitments.contract_company` is null/blank when syncing a Subcontract→Bill. | Edit the commitment and set a Contract Company. |
| `"This commitment has no Contract Company, and QuickBooks requires a vendor on every Purchase Order. Edit the commitment, set the Contract Company, then sync again."` | Same for PO→PurchaseOrder. | Same. |
| `"This prime contract has no Owner/Client, and QuickBooks requires a customer on every Invoice. Edit the contract, set the Owner/Client, then sync again."` | `prime_contracts.owner_client` is null/blank. | Edit the prime contract and set an Owner/Client. |

---

### 11.3 QBO Sync Configuration Errors (HTTP 502)

Indicate server-side configuration or QBO account setup issues. Not `validation: true`.

| Error Message | Trigger | Resolution |
|---|---|---|
| `"No QBO expense account found. Set QBO_AP_EXPENSE_ACCOUNT to a valid expense or COGS account."` | No active Expense/COGS accounts found during auto-detect. | Add an active Expense or COGS account in QBO, or set `QBO_AP_EXPENSE_ACCOUNT` explicitly. |
| `"Could not resolve or create QBO vendor \"{name}\": {detail}"` | `findOrCreateVendorId` failed. `detail` contains the QBO fault. | Check QBO for duplicate/inactive vendor names; verify Intuit API connectivity. |
| `"Could not resolve or create QBO customer \"{name}\": {detail}"` | `findOrCreateCustomerId` failed. | Same as vendor. |
| `"Could not resolve or create a QBO item for the invoice line."` | Item resolution/auto-creation failed for a PO or Invoice line. | Verify `QBO_DEFAULT_ITEM` is a valid item name; check QBO Items list for the company. |
| `"no vendor name provided"` | `findOrCreateVendorId` called with empty name. Internal guard. | Indicates `contract_company` was empty despite earlier validation passing. File a bug. |
| `"no customer name provided"` | Same for customer. | Same. |

---

### 11.4 QBO Fault Errors (HTTP 502)

Parsed from Intuit API error responses by `extractQBOError`. Checked in this order:

1. `json.Fault.Error[0].Detail`
2. `json.Fault.Error[0].Message`
3. `json.message`
4. `rawText.slice(0, 500)`
5. Fallback string: `"Unknown QuickBooks error"`

Common Intuit fault scenarios:

| Fault Detail Pattern | Meaning | Resolution |
|---|---|---|
| `"Business Validation Error: Stale Object error..."` | SyncToken is out of date; concurrent update beat this one. | The next sync attempt will re-fetch SyncToken and retry automatically. |
| `"Object Not Found: Something you're trying to use has been made inactive..."` | Referenced vendor, customer, or item is inactive in QBO. | Reactivate the QBO entity. |
| `"Authorization failure. OAuth token rejected."` | Access token expired and refresh failed. | Reconnect QBO in Settings → Integrations. |

---

### 11.5 Sage Sync Errors (HTTP 422)

| Error Message | Trigger | Resolution |
|---|---|---|
| `"Vendor \"{name}\" was not found in Sage 300 CRE. Create the vendor in Sage 300 CRE first, then re-sync."` | `GET /vendors` returned no match for the commitment's Contract Company name. | Create the vendor in Sage 300 CRE with the exact name shown in SiteCommand. |
| `"Customer \"{name}\" was not found in Sage 300 CRE. Create the customer in Sage 300 CRE first, then re-sync."` | Same for prime contract Owner/Client. | Create the customer in Sage 300 CRE with the exact name. |

---

### 11.6 Sage Connection Errors (HTTP 422)

| Error Message | Trigger | Resolution |
|---|---|---|
| `"Add your Agave Client ID and Client Secret first, then connect."` | `SAGE300CRE_CLIENT_ID` or `SAGE300CRE_CLIENT_SECRET` missing. | Add Agave app credentials in Settings → Integrations. |
| `"QuickBooks Online is already connected. Only one ERP integration may be connected at a time — disconnect QuickBooks in Settings → Integrations first."` | QBO tokens/realm are present for the company. | Disconnect QBO first. |

---

### 11.7 Agave API Errors (HTTP 502)

Parsed from Agave error responses by `extractAgaveError`. Checked in this order:

1. `json.message`
2. `json.error`
3. `json.detail`
4. `rawText.slice(0, 500)`
5. Fallback string: `"Unknown Agave error"`

---

### 11.8 Budget Resync Errors

| HTTP | Error Message | Trigger | Resolution |
|---|---|---|---|
| 400 | `"projectId is required"` | Request body missing `projectId`. | Include `projectId` in the POST body. |
| 403 | `"Forbidden"` | Project belongs to a different company than the calling user. | Use an account in the correct company. |
| 404 | `"Project not found"` | No `projects` row for the given UUID. | Verify the project ID. |
| 422 | `"Both QuickBooks and Sage 300 CRE are connected. Only one ERP integration may be connected at a time..."` | Both ERPs connected simultaneously. | Disconnect one ERP in Settings → Integrations. |
| 422 | `"No ERP integration is connected. Connect QuickBooks Online or Sage 300 CRE in Settings → Integrations first."` | Neither ERP connected. | Connect an ERP first. |
| 500 | `"Failed to load project: {error}. If this mentions a missing column, apply supabase/migrations/163_project_qbo_customer_mapping.sql."` | DB error loading the project row; typically means migration 163 has not been applied. | Apply migration 163. |

---

### 11.9 Budget Code Map Validation Errors (HTTP 400)

Returned by `PATCH /api/settings/company-integrations` when `QBO_BUDGET_CODE_MAP` fails validation.

| Error Message | Cause |
|---|---|
| `"Budget code map must be valid JSON."` | Value is not parseable JSON. |
| `"Budget code map must be a JSON object keyed by budget code."` | Parsed value is not a plain object (e.g. is an array or primitive). |
| `"Budget codes cannot be blank."` | An empty string `""` is used as a key. |
| `"Entry for \"{code}\" must be an object."` | Value for a code key is not a plain object. |
| `"\"{code}\".{field} must be a string."` | A field within a code entry (`item`, `account`, or `class`) is not a string type. |

---

### 11.10 Generic Route Errors

| HTTP | Error Message | Context |
|---|---|---|
| 400 | `"recordType and recordId are required"` | `/sync` or `/refresh` called without both required params. |
| 400 | `"Invalid recordType. Must be commitments or prime_contracts"` | `/refresh` route received an unsupported `recordType`. |
| 400 | `"Invalid recordType. Must be one of: commitments, prime_contracts, ap_invoice, ar_invoice"` | `/sync` route received an unsupported `recordType`. |
| 422 | `"No company associated with this account"` | Session user has no `company_id`. |
| 422 | `"This {entity} has not been synced to QuickBooks yet."` | `/refresh` called when `qbo_id` is null (record has never been synced). |
| 422 | `"QuickBooks Online is not connected. Connect in Settings → Integrations."` | QBO sync/refresh attempted without an active QBO connection. |

---

## 12. Data Types & Precision Rules

### 12.1 Money

| Layer | Type | Serialization Rule |
|---|---|---|
| SiteCommand DB | `NUMERIC(15,2)` | 15 significant digits, 2 decimal places. |
| QBO JSON payload | JSON number | Always `value.toFixed(2)`. Never send `null` — omit the key entirely if the value is null or zero and the field is optional. |
| Agave JSON payload | JSON number | Same: `.toFixed(2)`. |
| Retainage line calculation | — | `Math.round(billedAmount * (retainagePct / 100) * 100) / 100` before calling `toFixed(2)`. |

### 12.2 Quantities

| Layer | Type | Serialization Rule |
|---|---|---|
| SiteCommand DB | `NUMERIC(15,4)` | 4 decimal places. |
| QBO payload | JSON number | QBO accepts up to 5 decimal places. Send at DB precision (4 places). |
| Consistency gate | — | Include `Qty`/`UnitPrice` on a line only when `Math.abs(qty * unitCost - lineAmount) < 0.01`. |

### 12.3 Dates

| Layer | Type | Serialization Rule |
|---|---|---|
| SiteCommand DB | `DATE` or `TIMESTAMPTZ` | PostgreSQL DATE or TIMESTAMPTZ column. |
| ERP payload (QBO or Agave) | string | Always `"YYYY-MM-DD"`. Strip any time component from TIMESTAMPTZ before serializing. |
| Null handling | — | Omit the date key entirely when the DB value is null. Never send `null` or an empty string for a date field. |

### 12.4 String Limits

| Field | Max Length | Enforcement |
|---|---|---|
| QBO `DocNumber` | 21 characters | Enforced by `QBO_DOC_NUMBER_PREFIX = "project"` path which caps at 21. All other prefix paths should be validated to stay within 21 chars. Intuit rejects `DocNumber` values exceeding 21 characters. |
| QBO `PrivateNote` | No enforced limit | No truncation applied in SiteCommand. QBO accepts multi-line strings here. |
| QBO `CustomerMemo.value` | No enforced limit | Same. |
| `erp_sync_logs.raw_response` | 8,000 characters | Truncated before insert to stay within the column limit. |

### 12.5 QBO Reference Objects

QBO uses typed reference objects. Always prefer Id-based references when the Id is known:

```json
{ "VendorRef": { "value": "123" } }
```

The name-based form `{ "name": "DisplayName" }` is used only for initial lookups before an Id is resolved. Once an Id is obtained, store it and use `value` on all subsequent operations.

### 12.6 Currency

- No `CurrencyRef` is sent in any QBO payload.
- All amounts are assumed to be in the QBO company realm's home currency.
- Multi-currency QBO company files are **out of scope** — amounts will be posted without currency codes, which may cause QBO to reject or misclassify them in a multi-currency realm.

### 12.7 Tax

- No `TxnTaxDetail` or `TaxCodeRef` is sent in any QBO payload.
- All amounts are treated as tax-exclusive.
- The SiteCommand SOV `tax_code` field is stored in the database but is not currently mapped to any QBO or Sage field during sync.

### 12.8 Agave API Versioning

- `API-Version: 2021-11-21` is sent on every Agave request.
- Changing this header selects a different Agave normalized schema. Any upgrade requires full regression testing of all Sage field mappings.
- Agave connector behavior for fields like actual cost (`actual_cost` vs `actual_amount` vs `cost_to_date`) is **connector-dependent** (varies by the Sage 300 CRE installation version at the customer site). The sync code probes multiple field-name variants in priority order for all connector-dependent fields.
