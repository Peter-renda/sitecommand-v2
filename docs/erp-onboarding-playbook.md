# SiteCommand ERP Integration Onboarding Playbook

**Audience:** SiteCommand Implementation Consultants and Customer Success Managers  
**Applies to:** QuickBooks Online (QBO) and Sage 300 CRE integrations  
**Last updated:** June 2026

---

## Table of Contents

1. [Pre-Connection Checklist](#1-pre-connection-checklist)
2. [QuickBooks Online: Step-by-Step Setup](#2-quickbooks-online-step-by-step-setup)
3. [Sage 300 CRE: Step-by-Step Setup](#3-sage-300-cre-step-by-step-setup)
4. [Data Readiness Checklist](#4-data-readiness-checklist)
5. [Budget Code Map Configuration Guide (QBO Only)](#5-budget-code-map-configuration-guide-qbo-only)
6. [Testing Protocol](#6-testing-protocol)
7. [Go-Live Sequence](#7-go-live-sequence)
8. [Permissions & User Access](#8-permissions--user-access)
9. [Mutual Exclusion Rule](#9-mutual-exclusion-rule)
10. [Post-Go-Live Monitoring](#10-post-go-live-monitoring)

---

## 1. Pre-Connection Checklist

Complete every item on this checklist before opening the integration UI. Skipping steps here is the most common cause of failed go-lives.

### Roles and Access

- [ ] Confirm the person doing setup is a **Company Super Admin** in SiteCommand. Integration connect/disconnect, posting settings, and Budget Code Map configuration all require Super Admin. Standard admins and members cannot perform these actions.
- [ ] Confirm a **SiteCommand Site Admin** is available to assist if company-level platform settings need to be set.

### SiteCommand Data Quality

- [ ] Every **commitment** that will be synced has a **Contract Company** set. Commitments without a Contract Company will fail validation and return a 422 error. Do not proceed until this is resolved.
- [ ] Every **prime contract** that will be synced has an **Owner/Client** set. Same enforcement applies.
- [ ] Project numbers are populated for all active projects. Project numbers feed DocNumber prefixes (QBO) and job resolution (Sage).
- [ ] Budget codes are set up on SOV lines for all commitments and prime contracts that will be synced. Budget codes drive the job-costing layer in both integrations.
- [ ] The project **Directory** is populated with accurate contact information (company name, email, phone, address). SiteCommand enriches auto-created QBO Vendors and Customers from directory data.

### ERP-Side Prerequisites (QBO)

- [ ] Customer has an active QuickBooks Online company file (or a sandbox company for testing).
- [ ] Customer has admin access to the QuickBooks Online account.
- [ ] Customer has access to the **Intuit Developer Portal** ([developer.intuit.com](https://developer.intuit.com)) to create an app and register the redirect URI. If a developer account does not exist, the customer must create one.
- [ ] The Intuit app has been created with both **Sandbox** (Development) and **Production** key sets. Development keys and Production keys are different credentials — do not mix them.

### ERP-Side Prerequisites (Sage 300 CRE)

- [ ] Sage 300 CRE is installed and running on the customer's **on-premise Windows server**.
- [ ] The customer has an **Agave account** at [agaveapi.com](https://agaveapi.com). Agave is the connectivity layer between SiteCommand and Sage 300 CRE — there is no direct API to Sage.
- [ ] The **Agave connector agent** has been installed and authenticated on the customer's Sage server. This is done through Agave's own setup process before SiteCommand is involved. Agave support can assist with this step.
- [ ] Sage 300 CRE contains **Vendors** and **Customers** for all contractors and owners who appear on SiteCommand commitments and prime contracts. SiteCommand will not auto-create them. Name matching must be exact (case-insensitive).
- [ ] Sage 300 CRE contains **Jobs** corresponding to SiteCommand projects (matched first by project number, then by name).
- [ ] Sage 300 CRE contains **Cost Codes** for all budget codes used on SOV lines (matched first by exact code, then by name).

---

## 2. QuickBooks Online: Step-by-Step Setup

### 2.1 Create the Intuit App and Register the Redirect URI

1. Go to [developer.intuit.com](https://developer.intuit.com) and sign in with the customer's Intuit developer account.
2. Click **Dashboard** → **Create an app** → select **QuickBooks Online and Payments**.
3. Name the app (e.g., "SiteCommand – [Company Name]").
4. Under **Keys & credentials**, note the **Client ID** and **Client Secret** for both the Development (sandbox) and Production environments.
5. Navigate to **Settings → Integrations** inside SiteCommand. Scroll to the **QuickBooks Online** section.
6. Copy the value shown in the **Redirect URI** field. This is the exact URI SiteCommand will send during OAuth — it is derived from your deployment URL (`NEXT_PUBLIC_APP_URL`) and cannot be guessed.

> **Note:** The redirect URI must match **byte-for-byte** what is registered in the Intuit Developer portal — including trailing slashes, protocol (`https://`), and exact path. A one-character mismatch will cause OAuth to fail with a redirect URI mismatch error.

7. Back in the Intuit Developer portal, under **Redirect URIs**, add the URI you copied from SiteCommand. Add it under both the Development and Production environments.
8. Save.

### 2.2 Configure Sandbox vs. Production Environment

1. In SiteCommand, go to **Settings → Integrations → QuickBooks Online**.
2. Under **Environment**, select **Sandbox** (for testing) or **Production** (for go-live).
3. Save. A blue **Sandbox** badge appears next to the Connected status when sandbox is active.

> **Note:** Sandbox uses Intuit Development credentials and connects to `sandbox-quickbooks.api.intuit.com`. Production uses Production credentials and connects to `quickbooks.api.intuit.com`. The OAuth authorize/token URLs are the same in both environments — only the REST API base URL differs. You must use the correct credential set for the selected environment, or the connection will fail after OAuth completes.

### 2.3 Enter App Credentials

1. In SiteCommand, go to **Settings → Integrations → QuickBooks Online → App Credentials**.
2. Enter the **Client ID** and **Client Secret** for the selected environment (Development for Sandbox, Production for Production).
3. Save.

### 2.4 Connect (OAuth Flow Walkthrough)

1. Click **Connect to QuickBooks**.
2. You are redirected to Intuit's authorization page. Sign in with the QuickBooks Online account that owns the company file.
3. Select the QuickBooks company to connect, and click **Authorize**.
4. You are redirected back to SiteCommand. The QuickBooks section should now show **Connected** with the realm ID.

> **Note:** SiteCommand sets a short-lived CSRF nonce cookie at the start of the OAuth flow and validates it on callback. If you see an "invalid state" error, clear cookies and retry. Do not open a second browser tab during the OAuth flow.

### 2.5 Validate the Connection

1. In SiteCommand, navigate to **Settings → Integrations → QuickBooks Online**.
2. Confirm the status shows **Connected**.
3. Confirm the **Redirect URI** shown matches what is registered in the Intuit Developer portal.
4. Click the **Vendors** and **Customers** dropdowns (or test by loading an Integration-related form) to confirm SiteCommand can read from QBO. A successful read confirms tokens are valid.

Access tokens expire approximately every 1 hour and are auto-refreshed on first use after expiry (no action needed). Refresh tokens expire after approximately 100 days of inactivity. If the refresh token expires, the customer must reconnect by clicking **Reconnect**.

### 2.6 Configure Posting Settings

Navigate to **Settings → Integrations → QuickBooks Online → Posting Settings**. Configure each of the following:

| Setting | Description | Recommendation |
|---|---|---|
| **Expense Account** (`QBO_AP_EXPENSE_ACCOUNT`) | Default expense account for commitment Bill lines when no budget-code-specific account is mapped. | Use the customer's primary job cost or subcontract expense account. |
| **Default Item** (`QBO_DEFAULT_ITEM`) | Default QBO Product/Service item for Bill lines when no budget-code-specific item is mapped. | Use a general "Subcontract Costs" or "Job Costs" item. |
| **Retainage Receivable Account** | QBO account for retainage withheld from AR Invoices (prime contracts). | Use the customer's retainage receivable account. |
| **Retainage Payable Account** | QBO account for retainage withheld on AP Bills (commitments). | Use the customer's retainage payable account. |
| **DocNumber Prefix** (`QBO_DOC_NUMBER_PREFIX`) | Set to `project` to prefix DocNumbers as `{project_number}-{commitment_number}`. Maximum 21 characters total. | Set to `project` for multi-project companies to prevent DocNumber collisions. |
| **Project Tracking** (`QBO_PROJECT_TRACKING`) | When enabled (default), each sync line includes a QBO Class named after the project. Set to `none` to disable. | Leave enabled for job costing via Classes. |

> **Note:** All posted amounts use QBO account/item IDs, never names. If an account or item cannot be resolved, the sync will fail fast and log an error. Confirm the account and item names entered match exactly what exists in QBO (check spelling and entity type).

### 2.7 Set Up the Budget Code Map

See [Section 5](#5-budget-code-map-configuration-guide-qbo-only) for full detail. At a high level:

1. In SiteCommand, go to **Settings → Integrations → QuickBooks Online → Budget Code Map**.
2. Add one row per budget code used in the project.
3. For each row, specify the QBO **Item** (recommended) and/or **QBO Account** (legacy).
4. Save.

### 2.8 Link a QBO Project/Customer to a SiteCommand Project

This per-project override is required when using the Items-based budget code map path to pull Job to Date Costs into the Budget tool.

1. Open the SiteCommand project.
2. Go to **Project Admin → ERP Integration**.
3. In the **QuickBooks Project / Customer** picker, search for and select the QBO Customer or Project that corresponds to this SiteCommand project.

> **Note:** In QBO, "Projects" are a subset of Customers. SiteCommand searches Projects first (filtering by `IsProject = true`), then sub-customers (matching by `:<name>` suffix), then plain Customers. If the picker shows no results, confirm the company file is connected and that the Customer exists in QBO. Only Company Super Admin and Project Admin-level users can set this override.

4. Save.

### 2.9 First Sync Checklist

Before running any syncs, confirm:

- [ ] Connection is validated (status shows Connected).
- [ ] Posting settings are saved (expense account, default item, retainage accounts).
- [ ] Budget Code Map has at least one entry (if job costing is in scope).
- [ ] Per-project QBO Customer override is set on each active project (if using Items-based budget pull).
- [ ] All commitments have Contract Company set.
- [ ] All prime contracts have Owner/Client set.

Then run the first manual sync:

1. Open a commitment detail page.
2. Click **Sync to QuickBooks** in the page header.
3. Check the response for any validation errors.
4. Open the sync log at **Settings → Integrations → QuickBooks Online → Sync Logs** to confirm the record posted successfully.

---

## 3. Sage 300 CRE: Step-by-Step Setup

### 3.1 Prerequisites on the Sage Side

Complete all of these before touching SiteCommand:

1. Confirm Sage 300 CRE is installed and actively running on the customer's Windows server.
2. Confirm the customer has an **Agave account** ([agaveapi.com](https://agaveapi.com)). If not, the customer must sign up. Agave is a paid third-party connector — coordinate with the customer on procurement.
3. Work with the customer and Agave support to **install the Agave connector agent** on the same Windows machine (or network-accessible machine) as Sage 300 CRE. The connector authenticates the local Sage instance and registers it with Agave's cloud API.
4. Confirm the agent is running and that Agave shows the company's Sage instance as connected in the Agave dashboard.
5. Confirm Vendors, Customers, Jobs, and Cost Codes exist in Sage for all records that will be synced (see [Section 4](#4-data-readiness-checklist)).

### 3.2 Register with Agave and Get App Credentials

1. In the Agave developer portal, create an application for this customer's integration.
2. Note the **Client ID** and **Client Secret** Agave provides.

### 3.3 Enter App Credentials in SiteCommand

1. Go to **Settings → Integrations → Sage 300 CRE → App Credentials** (Site Admin view).
2. Enter the Agave **Client ID** and **Client Secret**.
3. Save.

> **Note:** App credentials are separate from the per-company Account Token that Agave Link will generate. Both are required. App credentials are typically managed at the SiteCommand platform level; per-customer Account Tokens are managed per company.

### 3.4 Run Agave Link Flow (Connect)

1. In SiteCommand, go to **Settings → Integrations → Sage 300 CRE** as a **Company Super Admin**.
2. Click **Connect to Sage 300 CRE**. SiteCommand calls Agave to generate a Link Token.
3. The **Agave Link** UI opens. Select **Sage 300 CRE** from the connector list.
4. Follow Agave's authentication prompts to authorize SiteCommand's access to the customer's Sage instance.
5. Upon completion, Agave issues a **public token**. SiteCommand exchanges this for a permanent **Account Token** and stores it.
6. The Sage 300 CRE section in Settings should now show **Connected**.

> **Note:** If Agave Link does not show Sage 300 CRE as an option, the on-premise agent may not be registered correctly. Return to Step 3.1 and work with Agave support.

As a fallback, Account Tokens can also be pasted manually into the Sage 300 CRE settings section if Agave provides one directly.

### 3.5 Validate the Connection

1. Confirm **Settings → Integrations → Sage 300 CRE** shows **Connected**.
2. Test the connection by navigating to a commitment detail page and clicking **Sync to Sage 300 CRE**.
3. Check the sync log. A successful initial sync (or a helpful error indicating a data issue) confirms the connector is live. A network or authentication error indicates the Account Token or agent connection is not working.

### 3.6 First Sync Checklist

Before running any syncs:

- [ ] Agave agent is installed, running, and registered.
- [ ] Connection is validated in SiteCommand.
- [ ] Vendors exist in Sage by exact name (case-insensitive) for all Contract Companies on commitments.
- [ ] Customers exist in Sage by exact name for all Owner/Client contacts on prime contracts.
- [ ] Jobs exist in Sage for all active SiteCommand projects (matched by project number, then project name).
- [ ] Cost Codes exist in Sage for all budget codes used on SOV lines (matched by code, then name).
- [ ] All commitments have Contract Company set.
- [ ] All prime contracts have Owner/Client set.

> **Note:** Sage Purchase Orders are non-posting headers. The AP Invoice sync is what creates actual GL entries in Sage. Plan your sync validation accordingly — do not expect to see journal entries from commitment sync alone.

---

## 4. Data Readiness Checklist

This checklist applies to all customers before any ERP sync, regardless of integration type.

### Commitments

- [ ] Every commitment to be synced has a **Contract Company** set. Blank Contract Company → sync fails with a 422 validation error.
- [ ] SOV lines have **budget codes** assigned. Budget codes drive job costing line items in both QBO and Sage.
- [ ] Commitment statuses are correct. Void and Terminated commitments will trigger deletions/closes in the ERP.
- [ ] Default retainage percentage is set on commitments where retainage applies.

### Prime Contracts

- [ ] Every prime contract to be synced has an **Owner/Client** set. Blank Owner/Client → sync fails with a 422 validation error.
- [ ] SOV lines have budget codes assigned.
- [ ] Stored materials amounts are entered where applicable. Stored materials post as a dedicated AR line.

### For QBO Specifically

- [ ] The **Contract Company** name on each commitment either matches an existing QBO Vendor, or the team accepts that SiteCommand will auto-create one. Auto-created Vendors are enriched with Directory contact data.
- [ ] The **Owner/Client** name on each prime contract either matches an existing QBO Customer, or the team accepts auto-creation.
- [ ] Payment terms used on commitments exist in QBO by exact name. Unmatched terms fall back to PrivateNote — they do not cause a sync failure but will not populate QBO payment terms.

### For Sage Specifically

- [ ] **Vendors must already exist in Sage.** SiteCommand will not create them. Confirm vendor names match the Contract Company names in SiteCommand. Name matching is case-insensitive but otherwise exact.
- [ ] **Customers must already exist in Sage.** Same rule applies for Owner/Client on prime contracts.
- [ ] **Jobs must already exist in Sage** for all active projects. Resolution order: project number (exact match) → project name (exact match).
- [ ] **Cost Codes must already exist in Sage** for all budget codes. Resolution order: exact code → name match. Unresolved cost codes are omitted from the payload (not a hard error), but those lines will post without job-costing detail.

---

## 5. Budget Code Map Configuration Guide (QBO Only)

### Why It Matters

The Budget Code Map is the bridge between SiteCommand's budget codes and QuickBooks Online's chart of accounts and items. Without it, all commitment and invoice lines post to the single default expense account and default item — there is no job-costing granularity. With it, each budget code (e.g., `02-310.C`, `05-100.L`) maps to a specific QBO Item or Account, enabling true cost-code reporting inside QuickBooks.

The Budget Code Map also drives the **Resync with ERP** budget pull: SiteCommand reads P&L data from QBO grouped by Item (or Account), matches those back to budget codes via the map, and writes the totals into the Budget tool's **Job to Date Costs** column.

### Items-Based Path (Recommended for GCs)

This is the recommended approach for general contractors. The pattern is simple: **one QBO Item = one SiteCommand budget code.**

**How it works:**
- Each cost code (e.g., `02-310.C`) has a corresponding QBO Product/Service item with the same code as its name.
- When a commitment Bill or AP Invoice is posted to QBO, each SOV line is mapped to its QBO Item based on the budget code.
- When the Budget pull runs, SiteCommand reads the QBO ProfitAndLossDetail report scoped to the project's Customer, aggregates by `item_name`, and reverse-maps back to budget codes.

**When to use this path:**
- The customer's QBO file uses Items (Products & Services) for job cost tracking.
- The customer wants line-item-level P&L visibility in QBO.
- The customer is a general contractor with multiple projects in the same QBO realm.

### Account-Based Path (Legacy)

Use this path when the customer's chart of accounts has one dedicated expense account per cost code, and they are not using QBO Items for job tracking.

**How it works:**
- Each budget code maps to a QBO Expense/COGS/Other Expense account.
- SOV lines post to those accounts rather than items.
- The Budget pull uses the QBO ProfitAndLoss summary report scoped to the project's **QBO Class** (the project Class is auto-created during commitment sync, named after the project).

> **Note:** If the project cannot be matched to a QBO Class by name, the budget pull for that project returns empty and logs a warning. It will never aggregate company-wide totals. Always verify the Class was created successfully after the first commitment sync.

### How to Build the Map

1. Export the active Product/Service list from QBO (Reports → Product/Service List, or from the Items & Services menu).
2. Export the active expense accounts from QBO (Chart of Accounts).
3. In a spreadsheet, build a mapping of SiteCommand budget codes to QBO Items and/or Accounts.
4. In SiteCommand, go to **Settings → Integrations → QuickBooks Online → Budget Code Map**.
5. Use the table editor to add one row per budget code. The Item and Account pickers are `datalist`-backed — start typing to search QBO entities loaded from your connected company file.
6. Click **Save**.

> **Note:** Each row must have either an **Item** or an **Account** (or both). A row with only a Class and no Item or Account will be rejected on save. Class is optional and supplements Item or Account mapping.

### Example JSON

The Budget Code Map is stored internally as JSON. Here is an example of a properly structured map:

```json
{
  "02-310.C": {
    "item": "02-310.C",
    "class": "Project-Alpha"
  },
  "03-300.L": {
    "item": "03-300.L"
  },
  "05-100.M": {
    "account": "Job Costs - Materials",
    "class": "Project-Alpha"
  },
  "07-200.S": {
    "item": "07-200.S",
    "account": "Subcontract Expense"
  }
}
```

- `item` — QBO Product/Service internal name. Items-based path.
- `account` — QBO Account name. Account-based path.
- `class` — Optional QBO Class for additional dimension tracking.
- Budget codes not in the map fall back to the **Default Item** and **Expense Account** posting settings.

---

## 6. Testing Protocol

### 6.1 Sandbox Test (QBO Only)

1. In **Settings → Integrations → QuickBooks Online → Environment**, select **Sandbox**.
2. Enter Development (sandbox) Client ID and Client Secret from the Intuit Developer portal.
3. Click **Connect to QuickBooks** and complete the OAuth flow using a sandbox QBO company.
4. Confirm Connected status.
5. Proceed with the test steps below against the sandbox company.
6. When testing is complete, disconnect sandbox and reconnect production (see [Section 7](#7-go-live-sequence)).

### 6.2 Create a Test Commitment and Prime Contract

1. In a test or sandbox SiteCommand project, create a **commitment** (subcontract or PO) with:
   - Contract Company set.
   - At least two SOV lines with distinct budget codes.
   - A default retainage percentage (e.g., 10%).
2. Create a **prime contract** with:
   - Owner/Client set.
   - At least two SOV lines with distinct budget codes.

### 6.3 Run Manual Sync

**Commitment:**
1. Open the test commitment detail page.
2. Click **Sync to QuickBooks** (or **Sync to Sage 300 CRE**).
3. Observe the response. A success response shows the QBO/Sage record ID.
4. If a validation error appears (422), address the missing data (Contract Company, budget codes, etc.) and retry.

**Prime Contract:**
1. Open the test prime contract detail page.
2. Click the sync button.
3. Observe the response.

### 6.4 Verify in QBO

1. In QuickBooks Online, navigate to **Bills** (for subcontracts) or **Purchase Orders** (for POs).
2. Confirm the record exists with:
   - Correct Vendor name.
   - Correct line items and amounts.
   - Correct Class on each line (if project tracking is enabled).
   - Correct DocNumber format (if `QBO_DOC_NUMBER_PREFIX=project`).
3. Navigate to **Invoices** to verify the prime contract posted correctly.
4. Confirm retainage lines appear on both Bills and Invoices.

### 6.5 Verify Accounting Feedback Fields Are Populated

1. Return to the SiteCommand commitment detail page.
2. Scroll to the **Accounting** section.
3. Confirm the following fields are populated:
   - **QBO Total Amount** (or Sage equivalent)
   - **QBO Balance**
   - **Payment Status** (`unpaid`, `partially_paid`, or `paid`)
4. If the Accounting section is empty, click **Refresh payment status** to trigger an on-demand pull.

### 6.6 Verify Budget Job-to-Date Costs Pull

1. Open the project **Budget** tool.
2. Confirm the **Job to Date Costs** column is visible in the budget view (add it via View settings if not visible).
3. Click **Resync with ERP** in the top-right actions.
4. In the confirmation modal, confirm the correct ERP is shown and click **Confirm**.
5. After completion, confirm the Job to Date Costs column shows values for the budget codes that have actual costs in QBO or Sage.
6. For QBO: verify the amounts match the P&L detail in QBO scoped to the project's Customer.
7. For Sage: verify the amounts match the job's cost-code actuals in Sage.

> **Note:** If Job to Date Costs are empty after a resync, check: (1) the per-project QBO Customer override is set in Project Admin (QBO items-based path), (2) the Budget Code Map has entries for the relevant codes, (3) actual transactions exist in QBO or Sage for those codes.

---

## 7. Go-Live Sequence

Follow this sequence in order. Do not skip steps.

### Step 1: Complete Testing in Sandbox (QBO Only)

- All test syncs pass with correct results in the sandbox QBO company.
- Accounting feedback fields populate correctly.
- Budget pull returns expected values.

### Step 2: Disconnect Sandbox and Connect Production (QBO Only)

1. In **Settings → Integrations → QuickBooks Online**, click **Disconnect**.
2. Confirm disconnection. This revokes the sandbox refresh token and clears stored tokens.
3. Change **Environment** to **Production**.
4. Enter Production Client ID and Client Secret from the Intuit Developer portal.
5. Click **Connect to QuickBooks** and complete the OAuth flow with the production QBO company.
6. Confirm Connected status.

> **Note:** Disconnecting does not delete posting settings, the Budget Code Map, or per-project Customer overrides. These are preserved across reconnects.

### Step 3: Sync Historical Records

For each active project that has existing commitments and prime contracts:

1. Open each commitment that should be in QBO/Sage.
2. Click the sync button. Commitments without prior `qbo_id` (or `sage300cre_id`) will be created in the ERP. Existing records will be updated.
3. Repeat for prime contracts.
4. Review sync logs for any failures. Address failures before handing off.

> **Note:** The daily cron will pick up dirty records automatically once running, but for the go-live day it is best practice to manually sync the highest-priority records rather than waiting for the overnight cron.

### Step 4: Verify Cron Is Running

1. In **Settings → Integrations → QuickBooks Online → Sync Logs** (or Sage equivalent), check the **Timestamp** column after 17:00 UTC (QBO) or 18:00 UTC (Sage) on the go-live day.
2. Confirm cron-initiated sync entries appear in the log.
3. The cron processes up to **25 dirty records per type per company** per run. Large historical backlogs may require multiple days to clear, or can be cleared with manual syncs.

### Step 5: Run Resync with ERP for All Active Projects

1. Open each active project's Budget tool.
2. Click **Resync with ERP** and confirm Job to Date Costs populate correctly.

### Step 6: Hand Off to Customer

Before handoff, confirm with the customer:

- [ ] They know where to find sync logs (**Settings → Integrations → [ERP] → Sync Logs**).
- [ ] They know the manual sync button location (commitment and prime contract detail pages).
- [ ] They know the **Refresh payment status** button location (commitment and prime contract detail pages).
- [ ] They know the cron schedule (QBO: 17:00 UTC daily; Sage: 18:00 UTC daily).
- [ ] They know that only **Company Super Admins** can reconnect, change posting settings, or modify the Budget Code Map.
- [ ] They know that if the refresh token expires (~100 days of inactivity for QBO), they must click **Reconnect**.

---

## 8. Permissions & User Access

| Action | Required Role |
|---|---|
| Connect / disconnect ERP integration | Company Super Admin or Site Command Admin |
| Configure posting settings (expense account, default item, retainage accounts, DocNumber prefix) | Company Super Admin |
| Manage Budget Code Map | Company Super Admin |
| Set per-project QBO Customer override (Project Admin → ERP Integration) | Company Super Admin or Project Admin-level user |
| Trigger manual sync (commitment or prime contract detail page) | Any company member with project access |
| View sync logs | Any company member |
| Click "Refresh payment status" on a detail page | Any user with read access to the record |
| Click "Resync with ERP" in the Budget tool | Any company member (non-external-collaborators) |

> **Note:** External collaborators cannot trigger ERP syncs or view integration settings. The Resync with ERP route verifies the user is a member of the company that owns the project — external collaborators are rejected.

---

## 9. Mutual Exclusion Rule

SiteCommand supports **one ERP connection at a time** per company. You cannot have both QuickBooks Online and Sage 300 CRE connected simultaneously.

### Why This Exists

ERP integrations are company-scoped. A record synced to QBO and then synced to Sage would create duplicate records in both systems with no common identifier, making reconciliation impossible. The mutual exclusion rule prevents this data integrity issue.

### Enforcement Points

- **Connecting QBO** when Sage 300 CRE is connected: the connect flow redirects with an error (`qbo_other_erp_connected`). Disconnect Sage first.
- **Connecting Sage** when QBO is connected: the connect API returns 422. Disconnect QBO first.
- **Resync with ERP (Budget pull)**: returns 422 if both are somehow connected (pre-existing dual connection) or if neither is connected.

### How to Switch from One ERP to Another

1. Go to **Settings → Integrations → [Current ERP]**.
2. Click **Disconnect**. Confirm the disconnection. For QBO, this revokes the refresh token at Intuit.
3. Navigate to **Settings → Integrations → [New ERP]**.
4. Follow the setup steps for the new ERP (Sections 2 or 3 above).

> **Note:** Disconnecting QBO or Sage does not remove sync history from SiteCommand (the `qbo_id`, `sage300cre_id`, and `last_synced_at` columns on records are not cleared on disconnect). If you reconnect the same ERP later, sync will resume using those IDs. If you switch to a different ERP, the old IDs become stale but do not interfere with the new integration — they are simply ignored by the new ERP's sync logic.

---

## 10. Post-Go-Live Monitoring

### How to Read Sync Logs

Navigate to **Settings → Integrations → [ERP] → Sync Logs**. Each entry includes:

| Column | What to look for |
|---|---|
| **Timestamp** | Whether the cron is running on schedule. |
| **Record Type** | `commitments`, `prime_contracts`, `ap_invoice`, `ar_invoice`, `budget_job_to_date`. |
| **Record ID** | The SiteCommand record that was synced. |
| **Integration** | `quickbooks` or `sage300cre`. |
| **Status / Result** | Success, error, or skipped. |
| **Error message** | For failures: actionable detail about what went wrong. |

**Common failure patterns and resolutions:**

| Error | Cause | Resolution |
|---|---|---|
| `validation: true` / 422 | Missing Contract Company or Owner/Client | Add the missing field to the record and retry. |
| Vendor not found (Sage) | Vendor name does not exactly match Sage | Add the vendor to Sage with the exact spelling, or update the Contract Company field in SiteCommand to match. |
| Class not found (QBO account-based) | No QBO Class matches the project name | Run a commitment sync first to auto-create the Class, then retry the budget pull. |
| 401 / token expired | QBO refresh token expired (~100 days) | Have Super Admin click Reconnect in Integration settings. |
| 404 → recreated (Sage) | Record was deleted in Sage | Normal behavior — SiteCommand recreates the record automatically. |

### Cron Schedule

| Integration | Cron time | Records per run |
|---|---|---|
| QuickBooks Online | 17:00 UTC daily | 25 dirty records per type per company |
| Sage 300 CRE | 18:00 UTC daily | 25 dirty records per type per company |

A record is "dirty" when its `updated_at` timestamp is more recent than its `last_synced_at` timestamp. New records and recently edited records are automatically picked up by the next cron run.

### Payment Status Refresh Cadence

- **Automatic:** The daily cron also runs a payment-status refresh pass — the 25 **stalest** synced records per table per company (ordered by `qbo_payments_refreshed_at` / `sage300cre_payments_refreshed_at`). This means every synced record gets a payment status refresh roughly every few days depending on volume.
- **On-demand:** Click **Refresh payment status** on any commitment or prime contract detail page to immediately re-read payment data from QBO or Sage for that specific record.
- **When to use on-demand refresh:** When a subcontractor confirms a payment was issued in QBO/Sage but SiteCommand still shows "unpaid." The cron may not have refreshed that specific record yet.

### What to Watch in the First 30 Days

- [ ] Cron runs appear in sync logs daily at the expected UTC times.
- [ ] No persistent validation failures (missing Contract Company, Owner/Client) — these indicate a data quality gap.
- [ ] Payment status fields populate within 1–2 days for all synced records.
- [ ] Budget Job to Date Costs update correctly after each **Resync with ERP**.
- [ ] QBO refresh token remains valid. Flag a reminder at day 90 post-connection to prompt the customer to reconnect proactively before the token expires at day 100.
- [ ] For Sage: confirm the Agave agent remains running on the customer's server. If the server is patched or restarted, the agent may need to be restarted as well.
