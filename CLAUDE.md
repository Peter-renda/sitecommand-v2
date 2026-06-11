# SiteCommand – Project Notes for Claude

## User Role Definitions

### 1. Site Command Admin *(internal team only)*
- Access to a super admin dashboard
- Toggle features on/off per company
- Impersonate or assist company admins for support
- Manage billing, plans, and seats across all accounts
- No access to actual project data unless needed for support

### 2. Company Super Admin *(the person who signed up / owns the account)*
- Manages the company's subscription and seats
- Invites and removes users within the company
- Promotes users to Admin
- Grants company users access to specific projects
- Full access to all projects under their company

### 3. Company Admin *(promoted by the Super Admin)*
- Can invite users and assign them to projects (within available seats)
- Full access to projects they're assigned to
- Cannot manage billing or change other admins' permissions

### 4. Company Member *(standard internal user)*
- Can only see and work within projects they've been added to
- Full create/edit/delete rights within those projects
- No user management capabilities

### 5. External Collaborator *(subcontractor, architect, owner, etc.)*
- Invited directly to a specific project, not the company
- Can respond to RFIs and submittals they're tagged on
- View-only everywhere else unless explicitly granted edit on a section
- No visibility into other projects or company data

## Commitments Tool

### Overview
- Project-level tool for managing purchase orders and subcontracts
- Lives under the project's **Contracts** tab
- Centralized data table with customizable columns (resize, show/hide, sort, pin), filtering, grouping, inline status edits, and CSV/PDF export

### Prerequisites
- The Commitments tool must be added to the project
- Advanced settings must be configured, including the accounting method for each commitment:
  - **Amount Based**
  - **Unit/Quantity Based**

### Tool-Level Permissions
The Commitments tool uses its own per-tool permission levels that layer on top of the role definitions above:
- **None** – no access
- **Read Only** – can view commitments and SOVs
- **Standard** – can work on items they are explicitly tied to (e.g., invoice contact) when granular permissions are enabled
- **Admin** – full create/edit/delete on commitments, SOVs, and Subcontractor SOVs

Role-to-tool mapping for SiteCommand:
- Site Command Admin: no project data access by default; may elevate for support
- Company Super Admin / Company Admin: Admin on Commitments for projects they manage
- Company Member: permission level set per project (Read Only, Standard, or Admin)
- External Collaborator: Read Only by default; may be set as **Invoice Contact** on a specific contract to edit that contract's Subcontractor SOV

### Schedule of Values (SOV) – Add a Line Item
- Requires **Admin** on the Commitments tool
- Commitment must be in **Draft**, unless **Enable Always Editable Schedule of Values** is turned on
- Steps: open the commitment → **Edit** → **Schedule of Values** → **Add Line**
- Required fields depend on accounting method:
  - **Amount Based**: budget code, description, amount
  - **Unit/Quantity Based**: budget code, description, quantity, UOM, unit cost (amount auto-calculates from qty × unit cost)
- For both methods: line number (**#**) is auto-generated sequentially, **Billed to Date** auto-calculates, and **Amount Remaining** is entered manually (unbilled amount)
- Optional per line: Change Event Line Item (if change events are enabled), Tax Code (if tax codes feature is enabled)
- **Save** or **Save & Email** (notifies the invoice contact)
- ERP integrations may add their own prerequisites and limitations

### Subcontractor SOV (SSOV) – Add to a Commitment
Lets a downstream contractor provide a detailed cost breakdown for each commitment line item, so the general SOV and the subcontractor's detail line up before invoicing.

Prerequisites:
- Contract must use **Amount Based** accounting (Unit/Quantity is not supported)
- **Subcontractor SOV** tab must be enabled on the commitment
- SSOV status must be **Draft** or **Revise & Resubmit**

Who can add SSOV line items:
- **Admin** on Commitments – on any contract
- **Invoice Contact** with Read Only or higher – on their assigned contract
- **Read Only** or **Standard** on a **non-private** contract – if the **Create Purchase Order Contract** or **Create Work Order Contract** granular permission is enabled
- **Standard** on a **private** contract – only if the user is both the Invoice Contact and a Private member, and the contract has **Allow Users to See SOV Items** checked

Workflow:
1. Admin creates/updates the general SOV on the commitment
2. Admin clicks **Send SSOV Notification** to alert the invoice contact (an invoice contact must be assigned first; otherwise add one before sending)
3. Invoice contact clicks **Edit** and adds detail lines until **Remaining to Allocate** is $0 — **Submit** stays disabled until the full committed amount is allocated
4. Invoice contact clicks **Submit**; status moves to **Under Review** (editing is blocked again unless returned to **Revise & Resubmit**)

Notes:
- Detail line items carry over to the invoice; only the detail lines carry over, not the general SOV lines
- SSOV detail does **not** sync with integrated ERP systems — only the general SOV does

## Change Events (Budget Changes) – Product Manual Alignment

### Overview
- The modern Change Events workflow is tied to Procore's **Budget Changes** experience, which replaces legacy budget modifications.
- Teams can configure **Budget ROM (Rough Order of Magnitude)** logic so Procore predicts budget impact using business rules.
- When a budget change is created from the Budget tool, Procore can auto-create and link a related change event.

### Details to Mirror in Product Messaging
- Support the three Budget ROM scopes in settings:
  - **In Scope**
  - **Out of Scope**
  - **TBD Scope**
- For each scope, support ROM source options:
  - **Latest Cost**
  - **Latest Price**
  - **None**
- Reflect that budget changes can be reviewed in the Budget tool and can also be created from a change event through a **Financial Impact** workflow.
- Reflect that teams can configure whether budget changes automatically create linked change events.

### Common Questions / Migration Notes
- Migration from **Budget Modifications** to **Budget Changes** is required (timeline managed by Procore).
- Companies using custom or third-party API integrations must update deprecated budget modification endpoints before migration.
- After migration:
  - Budget changes can sync with supported ERP integrations.
  - Legacy budget modifications no longer sync with ERP.
  - Users must use the modernized Change Events experience.
- Reporting impact should be called out: budget modifications and budget changes appear differently across snapshots, enhanced reporting, company/project reports, and analytics.
- During migration, only legacy budget modifications already linked to change event line items keep those associations; new associations are not created automatically.

## Change Events + T&M Tickets – Manual-Specific Workflow Alignment

### Add a Change Event Line Item to an Unapproved Commitment
- Bulk action name should read **Add to Unapproved Commitment**.
- Users can select line items across multiple change events before running the bulk action.
- Only unapproved commitments are valid targets.
- Do not allow this action when:
  - The commitment status is **Approved**.
  - Invoices already exist on the commitment.
- Expected result: selected change event line items create additional SOV lines on the chosen commitment.
- Permissions baseline:
  - **Admin** on Change Events.
  - **Admin** on Commitments.

### Add a Change Event Line Item to an Unapproved Prime PCO
- Bulk action name should read **Add to Unapproved Prime PCO**.
- Users can select line items from multiple change events.
- Only prime PCOs that are **not Approved** are valid targets.
- Expected result: selected change event line items are added to the prime PCO SOV.
- Permissions baseline:
  - **Admin** on Change Events.
  - **Admin** on Prime Contracts.

### Add a T&M Ticket to a Change Event
- In the T&M Tickets tool, support bulk actions for:
  - **Add to an Existing Change Event**
  - **Create Change Event**
- When linked, T&M ticket line items transfer to the change event.
- T&M ticket references/attachments should be represented in the change event description context.

## Budget + ERP + WBS Alignment Notes (Added April 17, 2026)

### About the Procore Standard Forecast View
- Treat **Procore Standard Forecast** as the default baseline forecasting layout.
- Keep Advanced Forecasting behavior configurable at the tool/settings level.
- Forecasting views should be assignable per project and designed as templates layered on top of the standard baseline.
- Forecasting UX should keep these high-signal columns visible by default:
  - Revised Budget
  - Projected Budget
  - Projected Costs
  - Forecast to Complete
  - Estimated Cost at Completion
  - Projected Over/Under

### About the Project Status Snapshots Tab
- The Budget tool should expose a dedicated **Project Status Snapshots** experience.
- Users should be able to:
  - View all snapshots over the project lifecycle.
  - Export snapshot list data to CSV.
  - Change snapshot status for approval tracking.
  - Compare two snapshots to analyze variance.
- Permissions baseline:
  - Read-only or higher on Budget to view snapshot list.
  - Elevated permissions for creating/updating snapshots.

### Accept or Reject a Budget for Export to ERP
- Budgets sent to ERP should pass through an accounting review state before export.
- Accounting approvers should be able to **Accept** (export) or **Reject** (return to editable budget state with reason).
- ERP-specific revision metadata may appear even for original budgets; users can ignore revision fields when no revision is being exported.
- Restriction messaging should be explicit:
  - ERP-exported budgets impact unlock/edit behavior.
  - Import/export rules vary by ERP connector.

### Activate Budget Codes on a Project
- Budget codes should support active/inactive lifecycle at the project level.
- Inactive codes should be excluded from budget-code dropdowns in project financial tools.
- Activation should support:
  - Single-code activation.
  - Bulk activation.
- Permission baseline should mirror Project Admin + WBS granular permission controls.

## Budget Tutorials Alignment Notes (Added April 17, 2026)

### Add a Budget Line Item
- Require both **Cost Code** and **Cost Type** when creating or editing a budget line item.
- Treat **Cost Code + Cost Type** as a unique budget code combination at the project level to prevent duplicates.
- Keep support for setting an original amount on unlocked budgets and preserve lock behavior on original amounts after budget lock.

### Add a GST to a Budget
- Provide a dedicated quick action for creating a **GST Budget Line Item**.
- GST entries should default the cost type to **Other** while still allowing users to set a dedicated tax cost code.
- Keep GST line items visually identifiable in the table so teams can report/govern tax tracking more clearly.

### Add a Job to Date Costs Column to a Budget View
- Keep **Job to Date Costs** visible as a source column in the Budget table and preserve a clear formula relationship with **Direct Costs**.
- Continue surfacing column-level formula help text so users can understand how calculated values are produced.
- For non-ERP projects, maintain language and UX that treats this as a configurable budget-view reporting column behavior.

### Add a Partial Budget Line Item
- Support creating **partial/unbudgeted budget line items** directly in the budget workflow.
- Partial line items should be created with a **$0 Original Budget Amount** and remain editable through downstream budget-change workflows.
- Keep partial line items visually marked (for example, with a `?` indicator) to help users identify unbudgeted scope quickly.

## 360 Reporting – Workflow Alignment Notes

### Export a Report
- Support export formats directly from report output:
  - **CSV**
  - **XLSX**
  - **PDF**
- Export actions should use the currently visible report state (filters, date range, calculated columns, grouping context when applicable).
- Clearly communicate row-limit constraints in the UI for heavy datasets when required.

### Get a Custom 360 Report from Assist
- Provide an **Assist** entry point in Reporting for users to describe desired outcomes in plain language.
- Assist should recommend a starting report/template and allow immediate creation from that recommendation.
- Keep the Assist flow lightweight: prompt → recommendation → create report draft.

### Promote a Project Report to Company Level
- Project reports can be promoted for reuse at the company level by authorized users.
- Promotion should be explicit and auditable in UI state (timestamp and actor).
- After promotion, report should be treated as a reusable company template while the project copy remains traceable.

### Share a Report
- Sharing should be report-specific and separate from dashboard sharing.
- Allow selecting target audiences (internal groups and, when allowed, external collaborators).
- Save share recipients with the report and reflect shared state in report management views.

### Edit / Distribute / Delete Lifecycle Expectations
- **Edit**: users can update report metadata post-creation without losing calculation configuration.
- **Distribute Snapshot**: users can send static report snapshots to recipients with format + schedule options.
- **Delete**: destructive action must require confirmation and clearly state irreversibility.

### Visual Type Configuration Expectations
- Offer visual tiles for at least:
  - Tabular Report
  - Bar Chart (vertical + horizontal)
  - Line Chart
  - Donut Chart
  - Stacked Bar Chart
  - Scorecard
- Creating a visual should follow a consistent sequence:
  1. Select visual type.
  2. Select dataset/report definition.
  3. Configure axes/measures (or columns for tabular reports).

## Change Orders + Financials Workflow Notes (Added April 17, 2026)

### Enable the Change Orders Tool
- Keep Change Orders as a configurable, project-level active tool.
- Admin workflow expectation:
  1. Open project **Admin**.
  2. Open **Active Tools**.
  3. Enable **Change Orders**.
  4. Save/update tool settings.
- Permission baseline: project Admin-level users manage tool activation.

### Enable Labor Productivity Cost Features
- In project Admin advanced settings, expose a toggle equivalent to **Labor Productivity for Budget, Change Events, and Change Orders**.
- This setting should be treated as a project-financials capability flag that influences Budget, Change Events, and Change Orders experiences together.

### View Change Orders
- Change Orders should remain a centralized viewing tool for both:
  - Prime Contract Change Orders (PCCOs)
  - Commitment Change Orders (CCOs)
- Keep separate tabs for Prime Contracts and Commitments.
- Change order creation should continue to happen from the parent financial contract workflows, not from the viewing list itself.

### Export a Single Change Order
- Support exporting an individual change order directly to **PDF** from its detail page.
- Support quick PDF export from list context where possible.
- Export should preserve key contract/accounting context (including budget code/SOV line data when present).

### Export a List of Change Orders (CSV/PDF)
- Support both **CSV** and **PDF** list exports from the Change Orders list UI.
- Exports should apply:
  - active tab scope (Prime vs Commitment),
  - current filters,
  - current sort order.

### Approve or Reject Change Orders (Reviewer Flow)
- A change order may have exactly one **Designated Reviewer**.
- Reviewer action eligibility:
  - User must be the designated reviewer.
  - Status must be a pending review state (for example, **Pending - In Review** or **Pending - Revised**).
- On Approve/Reject response:
  - update status,
  - set reviewer identity,
  - stamp review date,
  - persist reviewer response history context.

### Determine Approval Order
- Track an explicit **approved timestamp** on each change order.
- Surface approval chronology in the log so teams can identify the most recently approved item first.
- If an approved item needs to be edited/deleted, enforce or guide reverse-order unapproval behavior (latest approved first).

### Create Budget Codes in Financial Tools
- Continue supporting budget-code creation inline from financial line item/SOV entry flows.
- Support segmented budget-code composition from project WBS segments.
- Allow default concatenated description and optional custom description when creating a new code.

## Budget Tutorials Alignment Notes (Added April 17, 2026 - Round 2)

### Add the Columns for Job Cost Transaction Syncing to a Budget View for ERP Integrations
- Keep ERP-oriented budget views configured around **Job to Date Costs** and **Direct Costs** to preserve transaction-based visibility.
- Treat **Direct Costs** as a calculated value tied to source-cost detail visibility controls, and keep formula help text visible in-column.
- Maintain ERP-specific messaging that this setup is intended for supported ERP-connected workflows where job cost transactions are synced.

### Add the Columns for the Budget Changes Feature to a Budget View
- Ensure budget views used for change workflows expose source and calculated columns required for **Pending Budget Changes** and **Approved Change Order** analysis.
- Preserve the expectation that teams may either modify an existing view or create a dedicated **Budget Changes** view, then assign it to projects.
- Keep this configuration aligned with Change Events settings (including Budget ROM behavior).

### Add the Unit-Based Columns to a Budget View
- Support non-ERP unit-based budgeting workflows with these high-signal fields in budget experiences:
  - **Budget Unit Qty**
  - **Unit of Measure**
  - **Unit Cost**
- Preserve behavior where **manual calculation** can be toggled so teams can either enter an amount directly or derive it from unit inputs.
- Keep ERP caveat messaging clear: unit-based syncing behavior varies by ERP connector.

### Analyze Line Item Variance Between Budget Snapshots (Beta) / Analyze Variances Between Budget Snapshots
- Snapshot comparison UX should support selecting snapshot pairs and reviewing variance at the line-item level.
- Provide display modes for:
  - Comparison + variance values
  - Comparison values only
  - Variance values only
- Keep snapshot-level permissions language aligned with Budget tool expectations (read access for visibility, elevated access for creation/management).

### Apply Advanced Forecasting Curves
- Forecasting workflows should capture **Start Date**, **End Date**, and **Curve** per line item.
- Supported curve language should include at least:
  - **Linear**
  - **Bell**
  - **Manual**
- Keep **Procore Standard Forecast** as the baseline concept while allowing custom forecasting views.

### Apply the View, Group, and Filter Options on the Budget Detail Tab
- Budget Details UX should expose all three controls at the top of the tab:
  - **View**
  - **Group**
  - **Filter**
- Group/filter options should account for WBS-driven behavior (for example, Cost Code tiers and cost type groupings).

## Budget View Configuration Alignment (Added April 17, 2026)

### Add a Real-Time Labor Productivity Budget View
- Budget workflows should support a labor-productivity-focused layout that combines:
  - Budgeted production quantities
  - Installed quantities
  - Actual labor hours and labor cost
- The Budget UI should expose labor productivity metrics (for example units/hour and cost/hour) using live project entries.
- Messaging should reflect that this view is intended to reduce manual waiting/entry for labor cost visibility.

### Add Budgeted Production Quantities to a Project's Budget
- Include a dedicated Production Quantities experience at the project budget level.
- Line items should support:
  - Budgeted quantity
  - UOM
  - Installed quantity
- Require Budget admin-level access in role/permission mapping for editing production quantity entries.

### Add Cost ROM, RFQ, and Non-Commitment Cost Source Columns
- Budget views should allow Change Event source columns for:
  - Cost ROM
  - Cost RFQ
  - Non-Commitment Cost (NCC)
- Keep these values visible as distinct source data from standard budget amounts.
- Preserve workflow clarity that these columns are intended for Change Event financial impact tracking before/without commitment linkage.

### Add the ERP Direct Costs Column to a Budget View
- Budget views should support ERP-specific job cost source data:
  - ERP Job to Date Costs (source)
  - ERP Direct Costs (calculated from direct cost + ERP job cost source)
- Surface this as budget-view configuration behavior for ERP-integrated projects.
- Keep UI language clear that ERP-based columns are integration-driven and may be unavailable when ERP configuration is not enabled.
  4. Configure sort direction and optional advanced options.
- Advanced options should include as applicable:
  - Display units
  - Decimal precision
  - Max bars displayed
  - Legend/value labels toggles
  - Dual-axis and line-point toggles for line/combined visuals

### Filters and Calculations Expectations
- Keep **Load Data Manually** enabled by default to support larger datasets.
- Allow users to switch to auto-load behavior when needed.
- Filters should support common string conditions (match, contains, starts/ends with) and be composable.
- Calculation builder should support:
  - Basic math calculations with source columns and constants
  - Date variance calculations
  - Output format controls (number/currency/percent/date variance)
  - Decimal place and rounding behavior

### Convert Report to Dashboard Expectations
- Support converting an existing saved report directly into a draft dashboard.
- Conversion flow should mirror:
  - Open report
  - Preview in dashboard
  - Optional edits/additional visuals
  - Save as draft/publish later
- Dashboards should clearly enforce publish-before-share behavior.

### Edit 360 Report (Visuals + Dashboard Layout) Expectations
- Report editing should support:
  - Updating report title and description.
  - Adding tabs and reordering tabs.
  - Tab menu actions (rename, duplicate, delete).
  - Adding visuals from the editor and saving report-level changes.
- Visual card controls should include:
  - Edit card settings (title/description/config).
  - Duplicate card.
  - Delete card (irreversible warning).
  - Fullscreen card viewing/editing when possible.

### Add Visual to Project Single Tool Report Expectations
- Add Visual should be accessible from a report-level editor/menu flow.
- Respect workflow constraints:
  - Only report creator can add visuals to a cloned report.
  - Add Visual is available when record count is below the configured large-data threshold (2,500 in current guidance).
- Support PDF export including visuals when visuals are present.

### Aggregate Data in Project Single Tool Report Expectations
- Provide aggregate functions per column:
  - Count
  - Sum
  - Min
  - Max
  - Average
- Aggregation should be configurable from report edit controls and rendered in report output (e.g., summary/footer row).
- Function options should be constrained by field type where feasible (non-numeric fields default to count-only).

### Copy Project Single Tool Report Expectations
- Provide a **Make a Copy** action from report row actions and from within an opened report context.
- New copies should:
  - Be independent snapshots from the source report.
  - Append `-Copy` to the report name.
  - Preserve share-safe visibility semantics (copy only reveals data user can access).

## Procore Process-Guide Alignment Notes (Added April 17, 2026)

### Sources Reviewed
- https://v2.support.procore.com/process-guides/about-budget-changes/
- https://v2.support.procore.com/process-guides/about-budget-changes-on-owner-invoices/
- https://v2.support.procore.com/process-guides/budget-and-forecast-snapshots-user-guide/
- https://v2.support.procore.com/process-guides/company-administration-work-breakdown-structure-guide/

### Budget Changes + Change Events
- Keep language aligned to modern **Budget Changes** (not legacy Budget Modifications) for net-new workflows.
- Keep **Budget ROM** framing explicit across three scopes:
  - In Scope
  - Out of Scope
  - TBD Scope
- Keep ROM source guidance visible in UX copy and workflow docs:
  - Latest Cost
  - Latest Price
  - None
- Preserve messaging that Budget Changes can auto-create linked Change Events and can also be handled through Financial Impact workflows.

### Budget Changes on Owner Invoices
- Reflect that not every financial adjustment must use a Prime Contract Change Order (PCCO), especially in GMP/allowance-contingency scenarios.
- Keep support for adding approved budget changes to the latest owner invoice and grouping those lines for billing review.
- Keep owner-invoice workflow references in change-management guidance to reduce CO-overuse.

### Budget + Forecast Snapshots
- Treat snapshots as point-in-time financial baselines for variance analysis.
- Maintain user guidance for snapshot lifecycle actions:
  - Create snapshot
  - View snapshot
  - Configure/apply budget view context
  - Analyze variance
  - Export snapshot / export snapshot list
- Position snapshots as monthly-close and executive reporting controls.

### WBS (Company Administration)
- Treat WBS as a company-governed setup sequence before project-level execution:
  1. Define custom segments.
  2. Define segment items.
  3. Configure default cost code and cost type segments (including UOM where needed).
  4. Enable optional sub jobs.
  5. Set budget code structure and project edit controls.
- Keep project-level financial workflows dependent on stable company-level WBS governance.

### 360 Reporting Alignment Checklist
- Ensure report exports support **CSV, XLSX, and PDF** from current visible report state.
- Keep Assist flow lightweight: prompt -> recommendation -> create draft.
- Keep promotion audit metadata explicit (promoted timestamp + actor).
- Keep sharing model report-specific and distinct from dashboard sharing.
- Keep Add Visual threshold behavior explicit for large datasets (2,500+ row constraint messaging).
- Keep dashboard publish-before-share behavior explicit.

## Change Orders / ERP Alignment Notes (Added April 17, 2026)

### Edit a Change Order
- The project-level **Change Orders** tool should be treated as a central index for locating change orders, not as the sole authority for edit permissions.
- Edit eligibility should continue to defer to the parent financial tool permissions:
  - **Commitment Change Orders (CCOs)**: Admin on Commitments.
  - **Prime/Client/Funding Change Orders**: Admin on the corresponding contract tool.
- Keep explicit UX messaging that users may be blocked from editing/deleting based on status order and approval sequencing (for example, older approved COs may require rollback of newer approvals before edits).

### Configure Settings: Change Orders (Project Tool)
- Maintain project-level settings for:
  - Show/hide line items on **PCCO PDF exports**.
  - Show/hide line items on **CCO PDF exports**.
  - **Change reason behavior** mode:

## Procore Tutorial Alignment Notes (Added April 17, 2026 - DocuSign/ERP/Prime CO Round)

### Sources Reviewed
- https://v2.support.procore.com/product-manuals/docusign/tutorials/link-your-docusign-account-to-a-procore-project/
- https://v2.support.procore.com/product-manuals/erp-integrations-company/tutorials/retrieve-a-cco-from-erp-integrations-before-acceptance/
- https://v2.support.procore.com/product-manuals/commitments-project/tutorials/submit-a-field-initiated-change-order-as-a-collaborator/
- https://v2.support.procore.com/product-manuals/prime-contracts-project/tutorials/add-a-related-item-to-a-prime-contract-change-order/
- https://v2.support.procore.com/product-manuals/prime-contracts-project/tutorials/add-filters-to-the-change-orders-tab-on-a-prime-contract/
- https://v2.support.procore.com/product-manuals/prime-contracts-project/tutorials/add-financial-markup-to-prime-contract-change-orders/
- https://v2.support.procore.com/product-manuals/change-orders-project/tutorials/approve-or-reject-prime-contract-change-orders/
- https://v2.support.procore.com/product-manuals/prime-contracts-project/tutorials/configure-the-number-of-prime-contract-change-order-tiers/

### Link Your DocuSign Account to a Project
- Preserve two linking paths in guidance:
  - Link from profile settings.
  - Link from a DocuSign-enabled project workflow.
- Make synced-state messaging explicit once credentials are linked.

### Retrieve a CCO from ERP Integrations Before Acceptance
- Keep a **Retrieve from ERP** action available while a CCO is still pending accounting acceptance.
- After retrieval, unlock editing and allow re-send after correction.
- Keep permission baseline aligned with Commitments/Change Orders admin workflows.

### Submit a Field-Initiated Change Order as a Collaborator
- Keep collaborator flow scoped to approved commitments with correct permissions.
- Preserve private-by-default behavior for collaborator-initiated commitment COs.
- Keep auto-linked contract context and sequential numbering behavior in form guidance.

### Add a Related Item to a Prime Contract Change Order
- Keep related-item concept explicit as a cross-tool linkage between project records.
- Require active tools + view permissions for type/description selection visibility.
- Keep this as a detail-record workflow (open change order -> related items -> edit/save).

### Add Filters to the Change Orders Tab on a Prime Contract
- Keep Add Filter controls for:
  - Status
  - Executed
  - Change Reason
  - Change Type
- Preserve clear-all and per-filter clear behavior in UX expectations.

### Add Financial Markup to Prime Contract Change Orders
- Keep financial markup language aligned to two concepts:
  - Horizontal (line-level)
  - Vertical (subtotal-level)
- Keep project/tool-level prerequisites and permission messaging visible in workflow copy.

### Approve or Reject Prime Contract Change Orders
- Keep designated-reviewer logic strict:
  - Exactly one reviewer assigned.
  - Review actions allowed only in **Pending - In Review** or **Pending - Revised**.
- Record reviewer identity, comments context, and review date on response.

### Configure Number of Prime Contract Change Order Tiers
- Keep supported tier modes aligned to 1-tier, 2-tier (default), and 3-tier guidance.
- Enforce that tier configuration is set before creating the first prime-side CO.
- Disallow tier reconfiguration after first prime CO exists on the project.
    - predefined drop-down list, or
    - freeform text input.
- Keep permissions messaging explicit that these settings require **Admin** on the project Change Orders tool.

### Company Defaults: Change Management
- Company Admin should be the source of truth for default change-management lists:
  - **Change Reasons**
  - **Change Types**
  - **Change Event Statuses**
- Project tools should consume company defaults while allowing project-level availability toggles.
- Do not allow deletion of reasons/types/statuses that are already referenced by existing records.

### Commitment Change Orders + ERP Accounting Acceptance
- Add/maintain a clear pre-export accounting review stage for CCOs:
  - **Ready to Export** queue for accounting approvers.
  - **Accept** path exports to ERP.
  - **Reject** path returns CCO to editable project state with a required reason.
- Permissions model should distinguish between general ERP access and explicit “can push to accounting” privileges.

### Commitment Tool: Collaborator / Field-Initiated Change Orders
- Commitments advanced settings should support:
  - **Number of Commitment Change Order Tiers** (1, 2, or 3).
  - One-tier option for **Allow Standard Users to Create CCOs**.
  - Multi-tier option for **Allow Standard Users to Create PCOs**.
  - **Enable Field-Initiated Change Orders** (dependent on multi-tier + standard-user PCO setting).
- Field-initiated flows should support collaborator submissions against approved commitments while preserving contract privacy boundaries.

### Configure Number of Change Order Tiers (Cross-Tool Concept)
- Treat tier configuration as a contract lifecycle decision that should be set before live CO workflows begin.
- Preserve tool-specific tier behavior (Client Contracts, Commitments, Funding, Prime Contracts) while keeping the UX language consistent across financial tools.

### Create a Change Order / Create from Change Event
- Keep direct CO creation and change-event-originated CO creation as first-class flows.
- When creating from change events, preserve source linkage metadata so downstream reporting and audit history can show origin context.

### Prime Contracts: Enable Financial Markup
- Prime contract advanced settings should include a dedicated **Enable Financial Markup** toggle at the contract level.
- Enabling this setting is prerequisite behavior for applying markup rules on associated prime contract change orders.

## Commitment CO Workflow Notes from Procore Tutorials (Added April 17, 2026)

### Add a Change Event Line Item to an Unapproved Commitment CO
- Keep a bulk action labeled **Add to Unapproved Commitment CO** in Change Events.
- Allow selecting line items across multiple change events.
- Only show commitment CO targets that are not **Approved**.
- Result expectation: selected change event line items append as additional SOV lines on the chosen commitment CO.
- Permissions baseline:
  - **Admin** on Change Events.
  - **Admin** on Commitments.
- ERP caveat: linked ERP workflows may alter which options appear in bulk-action menus.

### Add a Related Item to a Commitment Change Order
- Commitment CO detail should support a **Related Items** association pattern.
- Only project tools that are active should appear as selectable related-item types.
- Related-item picker options should honor record-level view permissions in each tool.
- Permissions baseline:
  - **Admin** on Change Orders.

### Add Financial Markup to CCOs
- Require commitment-level financial markup enablement before rule entry on CCOs.
- Preserve proportional distribution behavior of markup across CCO SOV lines.
- Keep horizontal + vertical markup interaction explicit in UI/help text.
- Preserve limitation messaging:
  - CCOs with financial markup cannot be used on subcontractor invoices.
- Permissions baseline:
  - **Admin** on Commitments.

### Approve or Reject Commitment Change Orders
- Approval actions should be available to the assigned **Designated Reviewer** when CCO status is in pending review states.
- Keep reviewer identity + review date captured when action is submitted.
- Permission baseline:
  - **Standard** or above on Commitments and Change Orders, plus reviewer assignment.

### Bulk Create Commitment Change Orders from a Change Event
- Support bulk creation from selected change event line items where possible.
- Keep tiering guidance explicit in UX:
  - 2-tier: CE > CPCO > CCO
  - 3-tier: CE > CPCO > COR > CCO
- Preserve vendor/contract grouping context before record creation.
- Permissions baseline:
  - **Standard+** on Change Events.
  - **Admin** on Commitments.

### Prerequisites
- A commitment (Purchase Order or Subcontract) must exist.

### Workflow
1. Open the project's Commitments tool → **Contracts** tab → locate the contract.
2. Click **Edit**.
3. Click **Email Contract** (in the edit page header).
4. Fill in the email form:
   - **To** — select recipients from the Project Directory (must be in directory to receive emails)
   - **Cc** — additional directory contacts for carbon copy
   - **Private** — check to restrict viewing to admins and email recipients only
   - **Subject** — email subject line
   - **Message** — instructions or context for recipients
5. Click **Send**.

### What Recipients Receive
- An email with:
  - A **View Online** link (requires appropriate project access permissions).
  - A **Download PDF** link.
- Recipients must be added to the Project Directory.

### Implementation Notes (SiteCommand)
- "Email Contract" button in the edit page header (`EditCommitmentClient.tsx`).
- Opens `EmailContractModal` — recipients selected from project directory contacts with emails.
- API: `POST /api/projects/[id]/commitments/[commitmentId]/email` — requires Standard or Admin tool permission.
- Email function: `sendCommitmentEmail()` in `/lib/email.ts` using Resend.
- CC recipients passed directly to Resend's `cc` field.
- Private flag shown in email footer note when enabled.

## Enable Financial Markup on a Commitment

### Required Permissions
- **Admin** level on the Commitments tool.

### Prerequisites
- A Purchase Order or Subcontract must exist.
- Financial Markup must be **enabled at the project level** first (Commitments Settings → Financial Markup section).

### Workflow
1. Enable Financial Markup at the project level: Commitments tool → **Configure Settings** (gear icon) → **Financial Markup** → check **Enable Financial Markup on Commitment Change Orders** → **Save**.
2. Open the commitment (Commitments → Contracts tab → click contract number).
3. Click **Edit**.
4. In the **General Information** section, check **Enable Financial Markups on this commitment**.
5. Click **Save**.

### Key Limitation
- Financial markup can only be applied to **Commitment Change Orders (CCOs)** — not to the original SOV.
- Once markup is applied to a change order, that change order **cannot be added to a subcontractor invoice**.

### Implementation Notes (SiteCommand)
- Project-level toggle: `enable_financial_markup` column in `commitment_settings`, managed in `CommitmentSettingsClient.tsx`.
- Per-commitment toggle: `financial_markup_enabled` column on `commitments` table, exposed in `EditCommitmentClient.tsx` and `NewCommitmentClient.tsx`.
- The per-commitment checkbox is only shown/enabled when the project-level setting is on; otherwise, a link to Commitments Settings is shown.
- Migration: `supabase/migrations/092_commitments_extended_fields.sql` (commitment column) and `093_commitment_settings_defaults.sql` (settings column already existed in 092).
- API PATCH: `financial_markup_enabled` is an allowed field in `/api/projects/[id]/commitments/[commitmentId]/route.ts`.

## Enable or Disable the SSOV Tab on the Commitments Tool

### Overview
The Subcontractor SOV (SSOV) tab lets a downstream contractor provide a detailed cost breakdown for each SOV line item before invoicing. It can be toggled at both the **project level** (as a default) and **per individual commitment**.

### Required Permissions
- **Admin** level on the Commitments tool.

### Key Constraints
- **Amount Based accounting method only** — the SSOV tab is NOT supported with Unit/Quantity Based accounting.
- If **Enable Always Editable Schedule of Values** is active, additional workflow limitations apply.
- SSOV detail does not sync with ERP integrations; only the general SOV does.

### Project-Level Workflow (Default Setting)
1. Open the Commitments tool → **Configure Settings** (gear icon).
2. Navigate to the **Default Contract Settings** section.
3. Check or uncheck **Enable Subcontractor SOV by Default**.
4. Click **Save / Update**.

Effect: all new commitments created after saving will have the SSOV tab enabled (if Amount Based accounting method is selected).

### Per-Commitment Workflow
1. Open the commitment → **Edit**.
2. In the **Subcontractor SOV** section, check or uncheck **Enable Subcontractor SOV**.
3. **Save**.

### Implementation Notes (SiteCommand)
- Project-level default: `enable_ssov_by_default` column in `commitment_settings` (migration `093_commitment_settings_defaults.sql`).
- Settings UI: `CommitmentSettingsClient.tsx` → **Default Contract Settings** section.
- New commitment: `NewCommitmentClient.tsx` fetches `commitment-settings` on mount and pre-checks `ssovEnabled` if `enable_ssov_by_default` is true; sends `ssov_enabled` in the POST body.
- Edit commitment: `EditCommitmentClient.tsx` → **Subcontractor SOV** section toggle.
- The SSOV toggle is hidden/disabled when the commitment uses Unit/Quantity Based accounting.

## Export a Commitment (Individual)

### Required Permissions
- **Read Only** or higher on the Commitments tool.

### Workflow
1. Open the commitment detail page.
2. Click **Export** button in the page header.
3. Choose format:
   - **Export as PDF** — prints the commitment summary + SOV via browser print dialog.
   - **Export SOV as CSV** — downloads a CSV of the Schedule of Values line items.

### Implementation Notes (SiteCommand)
- Export dropdown button in `CommitmentDetailClient.tsx` header between Delete and Edit.
- `exportCommitmentPDF()` builds an HTML document with commitment metadata and SOV table, renders in a hidden iframe, and triggers `window.print()`.
- `exportSovCSV()` generates a CSV of non-group-header SOV lines; columns adapt to accounting method (Amount Based vs Unit/Quantity Based).

## Export a Commitments List

### Required Permissions
- **Read Only** or higher on the Commitments tool.

### Workflow
1. Open the Commitments tool → **Contracts** tab.
2. Apply any desired filters (the export reflects visible rows).
3. Click **Export** dropdown in the top-right actions.
4. Choose **Export as CSV** or **Export as PDF**.

### Implementation Notes (SiteCommand)
- Export dropdown in `CommitmentsClient.tsx` top-right actions bar.
- `exportCSV()` exports all currently visible items (post-filter/sort).
- `exportPDF()` builds an HTML table and prints via hidden iframe.

## Import a Subcontractor Schedule of Values from a CSV

### Required Permissions
- Admin on Commitments, OR Invoice Contact with Read Only or higher.

### Prerequisites
- Contract must use Amount Based accounting.
- SSOV tab must be enabled on the commitment.
- SSOV status must be Draft or Revise & Resubmit.

### Workflow
1. Open the commitment → **Edit** → **Subcontractor SOV** tab (or navigate to the SSOV edit page).
2. Click **Import CSV** at the bottom of the table.
3. In the modal:
   - Optionally download the **template CSV**.
   - Select delimiter (Comma or Semicolon).
   - Choose a CSV file.
   - Click **Import**.
4. The CSV is parsed and lines are loaded into the table for review before saving.

### CSV Required Columns
- **SOV Position Number** — maps the detail line to the parent SOV line by position.
- **Subcontractor SOV Amount** — the dollar amount for the detail line.

### Optional Columns
- **Budget Code**
- **Description**

### Implementation Notes (SiteCommand)
- Import CSV button in `SsovEditClient.tsx` at the bottom of the SSOV table (visible when not read-only).
- `downloadTemplate()` creates and downloads a sample CSV template.
- `parseImportCSV()` parses the file respecting the chosen delimiter, validates required columns, and returns `SsovLine[]` or an error string.
- Success banner shown after import; imported lines are in edit state (not yet saved) so the user can review before clicking Save.

## Manage Rows and Columns in the Commitments Tool

### Overview
Users can customize the Commitments table: show/hide columns, change row height, sort by any column, and filter by type/status/executed.

### Column Management
- Click **Table Settings** (top-right of the table toolbar) to open the column panel.
- Toggle individual columns on/off. Mandatory columns (#, Contract Company) cannot be hidden.
- **Show All** reveals all columns; **Reset** hides all optional columns.

### Row Height
- In **Table Settings**, choose Small, Medium (default), or Large row height.

### Sorting
- Click any column header to sort ascending; click again for descending; click a third time to clear.
- Sort indicator (↑ / ↓) appears on the active sort column.

### Filtering
- Click **Filters** button to open the filter panel.
- Filter by: Type (Subcontract / Purchase Order), Status (Draft / Approved / Void / Terminated), Executed (Yes / No).
- Active filter count badge shown on the Filters button.
- **Clear all** removes all active filters.

### Implementation Notes (SiteCommand)
- All state in `CommitmentsClient.tsx`: `hiddenCols` (Set<string>), `sortConfig`, `rowHeight`, `tableSettingsOpen`, `showFilterPanel`, `filterType`, `filterStatus`, `filterExecuted`.
- `ALL_COLS` defines all columns with `mandatory` flag; `COLS` is filtered by `hiddenCols`.
- `applySort()` sorts items client-side by any column key, including computed `revised_contract_amount`.
- `visibleItems` applies both search and filter predicates, then `applySort`.
- Row height classes applied to `<td>` elements: `py-1` / `py-3` / `py-5`.

## Search for and Apply Filters to the Commitments Tool

### Required Permissions
- **Read Only** or higher on the Commitments tool.

### Workflow

*Searching:*
1. Open the Commitments tool → Contracts tab.
2. Type in the Search field to filter by contract number, company, or title.

*Filtering:*
1. Click **Filters** to open the filter panel.
2. Apply filters:
   - **Contract Company** — text search to narrow by company name.
   - **Type** — Subcontract or Purchase Order.
   - **Status** — Draft, Approved, Processing, Submitted, Out For Bid, Out For Signature, Complete, Void, Terminated.
   - **Executed** — Yes, No, or Any.
3. Remove individual filters or click **Clear all** to reset.

### Implementation Notes (SiteCommand)
- Filter panel in `CommitmentsClient.tsx`: `filterCompany` (text), `filterType`, `filterStatus`, `filterExecuted`.
- Active filter count badge shown on the Filters button.
- `visibleItems` applies all four filter predicates plus search, then sort.

## View a Purchase Order

### Required Permissions
- **Non-Private POs**: Read Only or higher on Commitments.
- **Private POs**: Admin, or Read Only/Standard + membership on the Private list, or the "View Private Purchase Order Contract" granular permission.

### Workflow
1. Open the Commitments tool → Contracts tab.
2. Locate the purchase order and click its number to open the detail page.
3. Navigate tabs: General, Change Orders, Invoices, Payments Issued, Related Items, Emails, Change History, Financial Markup.

### Available Tabs
| Tab | Content |
|-----|---------|
| General | Contract details, SOV, financial summary, contract dates, privacy settings, additional information |
| Change Orders | Approved/pending change orders (placeholder — coming soon) |
| Invoices | Subcontractor invoices (placeholder) |
| Payments Issued | Payment records (placeholder) |
| Related Items | Linked documents (placeholder) |
| Emails | Communication history (placeholder) |
| Change History | Audit log of all field modifications (Admin only) |
| Financial Markup | Markup rules on change orders (requires project-level setting) |

### Implementation Notes (SiteCommand)
- `DetailTab` type in `CommitmentDetailClient.tsx` covers all tabs.
- Placeholder tabs show a "coming soon" empty state.
- Change History tab loads lazily on first click via `/api/projects/[id]/commitments/[commitmentId]/history`.

## View a Subcontract

### Required Permissions
- **Non-Private**: Read Only or higher on Commitments.
- **Private**: Admin, or Read Only/Standard + Private list membership, or "View Private Work Order Contract" granular permission.

### Workflow
1. Open the Commitments tool → Contracts tab.
2. Click the subcontract number to open the detail page.
3. Navigate tabs: same set as Purchase Order (General, Change Orders, Invoices, Payments Issued, Related Items, Emails, Change History, Financial Markup).

### Implementation Notes (SiteCommand)
- Same tab structure as PO in `CommitmentDetailClient.tsx`.
- Subcontract-specific fields (start date, estimated/actual completion, signed contract received, inclusions, exclusions) shown in the General and Additional Information sections.

## View Inclusions/Exclusions on a Subcontract

### Required Permissions
- **Non-Private**: Read Only or higher on Commitments.
- **Private**: Admin, or Read Only/Standard + Private list membership.

### Workflow
1. Open the Commitments tool → Contracts tab → click the subcontract.
2. Scroll to the **Additional Information** section.
3. View the **Inclusions — Scope of Work** and **Exclusions** fields.

### Implementation Notes (SiteCommand)
- Inclusions and Exclusions are rendered as rich-text HTML in the **Additional Information** section of `CommitmentDetailClient.tsx` for subcontracts.
- They were moved from the General Information section to Additional Information to align with Procore's layout.
- Both fields are only shown when non-empty.

## View the Change History of a Commitment

### Required Permissions
- **Admin** level on the Commitments tool.

### Workflow
1. Open the Commitments tool → Contracts tab → click the commitment.
2. Click the **Change History** tab.
3. Review the audit log — each row shows: what was changed, previous value, new value, who changed it, and when.

### Key Notes
- Change history entries are never deleted.
- Rich-text fields (description, inclusions, exclusions) record only "Updated" without showing full HTML content.

### Implementation Notes (SiteCommand)
- Database: `commitment_change_history` table (migration `094_commitment_change_history.sql`).
- API: `GET /api/projects/[id]/commitments/[commitmentId]/history` — requires Admin tool permission.
- Changes recorded in `PATCH /api/projects/[id]/commitments/[commitmentId]` by comparing old vs new values for all tracked fields.
- Tracked fields include: status, executed, contract_company, title, default_retainage, amounts, ssov_enabled, is_private, sov_accounting_method, financial_markup_enabled, dates, inclusions, exclusions, description.
- Change History tab in `CommitmentDetailClient.tsx` fetches lazily on first tab click.

## Commitment Change Order (CCO) Workflows

### Configure the Number of Commitment Change Order Tiers

#### Required Permissions
- **Admin** level on the Commitments tool.

#### Key Rule
- Configure tiers **before** creating any change orders. Changing tiers after COs are created is not recommended.
- **1 Tier** — direct CCO creation (no PCO step required).
- **2 Tier** — Potential Change Order (PCO) must be created first, then promoted to a CCO.
- **3 Tier** — PCO → Change Order Request (COR) → CCO.

#### Workflow
1. Open the Commitments tool → **Configure Settings** (gear icon).
2. In the **Contract Configuration** section, set **Number of Commitment Change Order Tiers** to 1, 2, or 3.
3. Optionally enable:
   - **Allow Standard Level Users to Create CCOs** (1-tier only)
   - **Allow Standard Level Users to Create PCOs** (2/3-tier only)
   - **Enable Field-Initiated Change Orders** (requires "Allow Standard Users to Create PCOs" to be on)
4. Click **Save**.

#### Implementation Notes (SiteCommand)
- Database: `commitment_settings` columns `number_of_change_order_tiers`, `allow_standard_users_create_ccos`, `allow_standard_users_create_pcos`, `enable_field_initiated_change_orders` (migration `093_commitment_change_order_configuration.sql`).
- UI: `CommitmentSettingsClient.tsx` → **Contract Configuration** section; state variables `changeOrderTiers`, `allowStandardUsersCreateCcos`, `allowStandardUsersCreatePcos`, `enableFieldInitiatedCos` wired to GET/PUT of `/api/projects/[id]/commitment-settings`.
- **Bug fixed**: These state variables were previously missing from the component; the API route also had undefined variable references — both are now corrected.

---

### Create a Commitment Change Order (CCO)

#### Required Permissions
- **Admin** level on the Commitments tool, OR
- **Standard** + "Allow Standard Level Users to Create CCOs" setting enabled (1-tier only).

#### Workflow
1. Open a commitment → **Change Orders** tab → **Create CCO**.
2. Fill in the form: Title, Status, Change Reason, Private, Due Date, Designated Reviewer, Request Received From, Description, Amount.
3. Optionally add SOV line items on the **Schedule of Values** tab.
4. If financial markup is enabled on the commitment, configure it on the **Financial Markup** tab.
5. Click **Create**.

#### Implementation Notes (SiteCommand)
- Form: `NewCommitmentCOClient.tsx` at `/projects/[id]/commitments/[commitmentId]/change-orders/new`.
- API: `POST /api/projects/[id]/change-orders` — creates a `change_orders` row with `type = 'commitment'` and `commitment_id`.
- Accepts `eventIds` query param to pre-populate from change event line items.

---

### Approve or Reject Commitment Change Orders

#### Required Permissions
- The logged-in user must be the **Designated Reviewer** on the CCO.
- CCO status must be **Pending - In Review** or **Pending - Revised**.

#### Workflow
1. Open the CCO detail page.
2. If the logged-in user is the designated reviewer and the status is pending, **Approve** and **Reject** buttons appear in the header alongside a "Awaiting your review" notice.
3. Click **Approve** or **Reject**; status updates immediately and reviewer name + date are recorded.

#### Implementation Notes (SiteCommand)
- `ChangeOrderDetailClient.tsx`: `isReviewer` checks if `username === designatedReviewer`, `pendingReview` checks for the two pending statuses.
- `handleReview("Approved" | "Rejected")` PATCHes the change order with new status, reviewer name, and review date.
- **Already implemented** — no code changes needed.

---

### Create a CCO from a Change Event (Bulk)

#### Required Permissions
- **Standard** or **Admin** on Change Events.
- **Admin** on Commitments.

#### Workflow
1. Open the Change Events tool → select one or more line items via checkboxes.
2. Click **Bulk Actions** → **Create Commitment CO** → select the target commitment.
3. A new CCO is created with SOV pre-populated from the selected change event line items.

#### Implementation Notes (SiteCommand)
- `ChangeEventsClient.tsx`: "Create Commitment CO" bulk action navigates to `/projects/${projectId}/commitments/${c.id}/change-orders/new?eventIds=${eventIds}`.
- `NewCommitmentCOClient.tsx` reads the `eventIds` query param and fetches line items to pre-populate the SOV.
- **Already implemented** — no code changes needed.

---

### Bulk Create Commitment Change Orders from a Change Event

#### Required Permissions
- **Standard** or **Admin** on Change Events.
- **Admin** on Commitments.

#### Workflow (Procore)
In Procore, users can select change event line items across multiple commitments and use "Create Bulk Draft CCOs" to auto-group by vendor and create one CCO per commitment. SiteCommand's current approach navigates to a single CCO creation form targeting one commitment at a time (user selects which commitment).

#### Implementation Notes (SiteCommand)
- SiteCommand does not auto-group by vendor. Users must select a target commitment, then the CCO form pre-populates from the selected event line items.
- "Add to Unapproved Commitment CO" is also available as a separate bulk action.
- Full Procore-style bulk auto-grouping is a future enhancement.

---

### Create a Commitment Potential Change Order (PCO) from a Change Event

#### Required Permissions
- **Admin** on Commitments, OR **Standard** + "Allow Standard Level Users to Create PCOs" setting enabled.
- Only available in **2-tier** or **3-tier** CCO workflows.

#### Workflow (Procore)
1. Open the Change Events tool → select line items.
2. Click **Bulk Actions** → **Create Commitment PCO** → choose a commitment.
3. A new PCO is created with line items pre-populated.

#### Implementation Notes (SiteCommand)
- SiteCommand currently does not have a dedicated "Create Commitment PCO" bulk action in `ChangeEventsClient.tsx`. The "Create Commitment CO" path goes directly to a CCO for 1-tier setups.
- For 2/3-tier workflows, PCO creation from change events is a pending feature — currently users must create PCOs directly from within the commitment.

---

### Add a Related Item to a Commitment Change Order

#### Required Permissions
- **Admin** level on the Commitments tool (to add/delete related items).
- **Read Only** or higher (to view related items).

#### Workflow
1. Open the CCO detail page.
2. Click the **Related Items** tab.
3. To add: select Type, enter Description, Date, and Notes → click **Add Item**.
4. To remove: click the × button on any row (Admin only).

#### Item Types Supported
RFI, Submittal, Task, Bid, Meeting, Drawing, Specification Section, Potential Change Order, Change Order Request, Correspondence, Punch Item, Observation, Daily Log, Attachment, Other.

#### Implementation Notes (SiteCommand)
- Database: `change_order_related_items` table (migration `098_change_order_related_items.sql`).
- API:
  - `GET /POST /api/projects/[id]/change-orders/[changeOrderId]/related-items` — read_only GET, admin POST.
  - `PATCH /DELETE /api/projects/[id]/change-orders/[changeOrderId]/related-items/[itemId]` — admin only.
- UI: `ChangeOrderDetailClient.tsx` — **Related Items** tab added alongside the **General** tab. Tab shows item count badge when items exist. Add form visible only to admin users.

## Procore Tutorial Alignment Notes (Added April 18, 2026 - Commitments + Change Events)

### Sources Reviewed
- https://v2.support.procore.com/product-manuals/change-events-project/tutorials/add-a-change-event-line-item-to-an-unapproved-commitment/
- https://v2.support.procore.com/product-manuals/change-events-project/tutorials/add-a-change-event-line-item-to-an-unapproved-commitment-co/
- https://v2.support.procore.com/product-manuals/commitments-project/tutorials/enable-or-disable-the-ssov-tab-on-a-commitment/
- https://v2.support.procore.com/product-manuals/commitments-project/tutorials/import-commitment-sov-line-items-from-a-csv-file/
- https://v2.support.procore.com/product-manuals/commitments-project/tutorials/review-a-commitments-subcontractor-schedule-of-values/

### Add a Change Event Line Item to an Unapproved Commitment

#### Required Permissions
- **Admin** on Change Events AND **Admin** on Commitments.

#### Prerequisites
- The Change Events tool must be enabled on the project.

#### Limitations (per Procore)
Change event line items cannot be added to a commitment when:
- The commitment status is **Approved**.
- Invoices have already been created on the commitment.
- For ERP-integrated projects (Sage 300 CRE, QuickBooks Desktop, Viewpoint Spectrum) the target commitment must already have ≥1 SOV line item with a cost code (and cost type, depending on ERP).

#### Workflow
1. Open the Change Events tool.
2. Select the desired change event line items (may span multiple change events).
3. Click **Bulk Actions** → **Add to Unapproved Commitment**.
4. Pick the target unapproved commitment from the submenu (grouped by Subcontracts / Purchase Orders).
5. Additional SOV line items are added to the selected commitment.

#### Implementation Notes (SiteCommand)
- Bulk action is defined in `ChangeEventsClient.tsx` under the Bulk Actions dropdown (`Add to Unapproved Commitment` action, `commitment-submenu` with `unapprovedOnly: true`).
- Commitments are fetched from `/api/projects/[id]/commitments`; the submenu only lists commitments where `isUnapproved(c.status)`.
- The action is disabled (with inline tooltip "the selected line item has already be associated with a Commitment CO") when any selected line item already has a cost association to prevent double-linking.
- Current flow navigates to the commitment edit page with `eventIds` pre-selected, so new SOV lines can be added from the change event line items on save.
- **Invoices gate**: an Invoices module is not yet implemented on SiteCommand commitments (placeholder tab only). When invoices are introduced, the submenu must additionally filter out commitments that already have invoices (see `069_budget_restructure.sql::commitments_invoiced` column for the eventual data source).

### Add a Change Event Line Item to an Unapproved Commitment CO

#### Required Permissions
- **Admin** on Change Events AND **Admin** on Commitments.

#### Prerequisites
- A commitment potential change order (or CCO, depending on tiering) must exist for the target commitment.

#### Limitations (per Procore)
- Only commitment change orders that are **not Approved** are valid targets.
- For ERP-integrated projects, the bulk option may be replaced by an alternative SOV-linking workflow.
- Change event line items can be added before or after RFQ responses; when added after, SOV auto-populates with RFQ amounts.

#### Workflow
1. Open the Change Events tool.
2. Select change event line items (may span multiple events; filterable by vendor).
3. Click **Bulk Actions** → **Add to Unapproved Commitment CO**.
4. Pick the target unapproved CCO from the submenu.
5. SOV lines are appended to the CCO; navigation continues to the CCO detail page.

#### Implementation Notes (SiteCommand)
- Action `Add to Unapproved Commitment CO` (type `commitment-co-submenu`) in `ChangeEventsClient.tsx`.
- `allCommitmentCcos` is pre-filtered to status != `approved` (`/api/projects/[id]/change-orders?type=commitment` call + client-side filter).
- `addSelectedSovToCommitmentCco()` fetches the target CCO, merges existing `schedule_of_values` with new lines (deduping by `budget_code__description__amount`), preserves `budget_codes` and `source_change_event_ids`, recalculates the CCO `amount`, and PATCHes it.

### Enable or Disable the Subcontractor SOV Tab on a Commitment

#### Required Permissions
- **Admin** level on the Commitments tool.

#### Prerequisites
- A commitment must already exist.
- The commitment must use **Amount Based** accounting. The SSOV tab is NOT supported with Unit/Quantity Based accounting.

#### Project-Level Default
- Commitments tool → **Configure Settings** → **Default Contract Settings** → check/uncheck **Enable Subcontractor SOV by Default** → Save. Affects newly-created commitments.

#### Per-Commitment Workflow (Individual)
1. Open the commitment → **Edit**.
2. In the **Subcontractor SOV** section, check or uncheck **Enable Subcontractor SOV**.
3. Click **Save**.

#### Limitations
- Available only on Amount Based commitments — the toggle is hidden (with an inline explanation) when the SOV is Unit/Quantity Based.
- When **Enable Always Editable Schedule of Values** is active, additional workflow limitations apply to downstream SSOV edits.

#### Implementation Notes (SiteCommand)
- Project-level default: `enable_ssov_by_default` column in `commitment_settings` (migration `093_commitment_settings_defaults.sql`). Surfaced under **Default Contract Settings** in `CommitmentSettingsClient.tsx`.
- Per-commitment toggle: `ssov_enabled` column on `commitments` (migration `090_commitment_ssov_workflow.sql`). Toggle rendered in `EditCommitmentClient.tsx` under the **Subcontractor SOV** section (only when `sovMethod === "amount"`).
- New commitments pre-fill from `enable_ssov_by_default` in `NewCommitmentClient.tsx`.
- API `PATCH /api/projects/[id]/commitments/[commitmentId]` keeps `ssov_status` consistent with `ssov_enabled` (sets to `draft` when turning on, clears to `""` + nulls `ssov_notified_at`/`ssov_submitted_at` when turning off).

### Import Commitment SOV Line Items from a CSV File (General SOV)

#### Required Permissions
- **Admin** on Commitments, OR
- **Read Only** / **Standard** with the **Update Purchase Order Contract** or **Update Work Order Contract** granular permission enabled.

#### Prerequisites
- When **Enable Always Editable Schedule of Values** is OFF (default), the commitment must be in **Draft**.
- When **Enable Always Editable Schedule of Values** is ON, import can run at any status, but cannot replace invoiced line items.

#### CSV Columns by Accounting Method
- **Amount Based** (required): Budget Code, Amount. (Optional: Sub Job, Cost Type, Description, Tax Code.)
- **Unit/Quantity Based** (required): Budget Code, Quantity, UOM, Unit Price. (Optional: Sub Job, Cost Type, Description, Tax Code, Subtotal, Override.)
- **Cost Type** defaults to **Other** when blank.
- Amounts must use plain numerics (for example `15000`, not `$15,000`).

#### Things to Consider
- Delimiter may be **comma (,)** (default) or **semicolon (;)**.
- Template download options: **blank template** or **pre-populated with existing line items**.
- Import modes: **add additional items** or **replace all existing items**.
- ERP-integrated companies have additional prerequisites depending on the system.

#### Workflow
1. Open the commitment → **Edit** → scroll to **Schedule of Values**.
2. Click **Import SOV from CSV** below the SOV table.
3. Pick the delimiter, import mode, and (optionally) download a template.
4. Select a CSV file and click **Import**.
5. Imported lines appear in the SOV table for review. Click **Save** on the commitment to persist them.

#### Implementation Notes (SiteCommand)
- UI lives in `EditCommitmentClient.tsx`. The **Import SOV from CSV** button is shown below the SOV table and is disabled when the commitment status is not Draft and `Enable Always Editable Schedule of Values` is off.
- Helpers: `parseSovImportCSV(text, delimiter)` validates required columns per accounting method; `downloadSovTemplate("blank" | "existing")` produces a matching template.
- Import mode `replace` queues all existing saved SOV lines for deletion (via `removedDbIds.current`) before swapping in the imported lines; mode `add` appends lines. Nothing is persisted until the user clicks Save on the commitment.
- Imported lines are not linked to change events (`change_event_id` / `change_event_line_item_id` are left empty).

### Review a Commitment's Subcontractor SOV (Approve / Return for Revision)

#### Required Permissions
- **Admin** on the Commitments tool (to review, approve, or return the SSOV).

#### Prerequisites
- SSOV must be **enabled** on the commitment and the accounting method must be Amount Based.
- Line items must already have been added and submitted by the invoice contact (or entered by an upstream admin).

#### Review Actions
- **Approve**: available while status is **Under Review**. Transitions `ssov_status` from `under_review` → `approved` and records `ssov_approved_at`.
- **Return for Revision**: available while status is **Under Review**. Transitions `ssov_status` from `under_review` → `revise_resubmit` so the invoice contact can edit and resubmit.

#### Status Transitions
- `draft` → `under_review` (on Submit, once Remaining to Allocate = $0)
- `under_review` → `approved` (on Approve by admin)
- `under_review` → `revise_resubmit` (on Return for Revision by admin)
- `revise_resubmit` → `under_review` (on next Submit)

#### Workflow
1. Open the commitment detail page.
2. In the **Subcontractor SOV** section, confirm status is **Under Review**.
3. Click **Approve** to finalize or **Return to Revise & Resubmit** to send back for edits.

#### Implementation Notes (SiteCommand)
- **Approve endpoint** (new): `POST /api/projects/[id]/commitments/[commitmentId]/ssov/approve` — admin-only; validates SSOV is enabled, accounting method is `amount`, and status is `under_review`; updates `ssov_status = approved` and `ssov_approved_at`; writes a `commitment_change_history` row (`action: "Approved Subcontractor SOV"`) for audit.
- **Revise endpoint** (existing): `POST /api/projects/[id]/commitments/[commitmentId]/ssov/revise` — admin-only; transitions `under_review` → `revise_resubmit`.
- **Submit endpoint** (existing): `POST /api/projects/[id]/commitments/[commitmentId]/ssov/submit` — invoice-contact action; requires Remaining to Allocate = $0 and status `draft` or `revise_resubmit`.
- **Notify endpoint** (existing): `POST /api/projects/[id]/commitments/[commitmentId]/ssov/notify` — admin-only; sends email to the invoice contact while status is `draft` or `revise_resubmit`.
- UI: `SsovPanel` in `CommitmentDetailClient.tsx` surfaces **Send SSOV Notification** (when editable + contact assigned), **Edit Subcontractor SOV**, **Submit**, **Return to Revise & Resubmit**, and **Approve**. The review buttons only appear while status is `under_review` (`canReview`).
- Migration: `101_commitment_ssov_approved_at.sql` adds `commitments.ssov_approved_at` TIMESTAMPTZ.
- SiteCommand uses a single **invoice contact** on the commitment (`subcontractor_contact`) rather than a distribution list; notifications are sent to that contact only.

## Specifications – Spec Book PDF Storage

### Overview
The Specifications page lets a user upload a single PDF spec book per project. The PDF is parsed into per-section `project_specifications` rows AND persisted to storage so the **Open Specification Book** button in the page header can re-open it in a new browser tab.

### Storage
- Persistent PDF lives in the `project-drawings` Supabase bucket under `${projectId}/_spec-book/${timestamp}-${filename}` (250 MB file size limit per migration 124).
- Each project has at most one stored spec book; uploading a new one upserts the `project_spec_books` row and removes the previous storage file.

### Database
- Table `project_spec_books` (migration `125_project_spec_book.sql`) — one row per project (`UNIQUE(project_id)`): `filename`, `storage_path`, `total_pages`, `uploaded_at`.

### API
- `GET /api/projects/[id]/spec-book/upload-url?filename=…` — issues a signed PUT URL for the persistent `_spec-book/` storage path.
- `GET /api/projects/[id]/spec-book` — returns `{ specBook: { id, filename, totalPages, uploadedAt, url } | null }` where `url` is a fresh 1-hour signed download URL.
- `POST /api/projects/[id]/spec-book` — upserts the metadata row after the client has uploaded the PDF via the signed URL; rejects `storagePath` values outside `${projectId}/_spec-book/` and deletes the prior storage file when replacing.

### Client Flow (`SpecificationsClient.tsx`)
- On mount, fetches `/spec-book` to learn whether a book exists (used to populate the button tooltip).
- During parse review approval (`handleApproveParsedSections`), after creating per-section rows, the PDF retained in `uploadFiles` is uploaded to the signed URL and registered with `POST /spec-book`. Failures here are non-fatal — the sections still save and the user can re-upload to retry persistence.
- **Open Specification Book** opens a blank tab synchronously (to keep popup blockers happy), fetches a fresh signed URL via `GET /spec-book`, and redirects the new tab to that URL. If no spec book is stored, the new tab is closed and the user gets an alert explaining they need to upload one first.

## Permission Templates – Company-Level Defaults

### Overview
The Super Admin defines per-company permission templates under **Company → Permission Templates**. Templates are keyed by `(category, user_type)`:

- **Company**: `super_admin`, `admin`, `member`
- **Invitee**: `subcontractor`, `architect_engineer`, `owner_client`

Each template stores a level (`none` / `read_only` / `standard` / `admin`) per tool. Stored overrides live in `company_permission_templates` (migration `112_company_permission_templates.sql`); built-in defaults from `lib/permission-templates.ts` apply when no override is set.

### Level Semantics
- **None** — user cannot access the tool/page. `getToolLevel` returns `none`, gating endpoints reject, and the tool is hidden from navigation.
- **Read Only** — user can view but cannot edit, comment, or otherwise mutate state.
- **Standard** — user can view and interact with records, but cannot manage tool configuration or perform admin actions.
- **Admin** — full access to the tool, including configuration and admin-only actions.

### How Templates Become Real Permissions
- Templates are translated into rows in `project_tool_permissions` (one per tool slug) when:
  1. **Invite acceptance** (`POST /api/invite/[token]/accept`) — for both new and existing accounts. External invitees pull from the directory contact's `permission` field; internal `member` invitees get the `company.member` template.
  2. **Directory contact PATCH** (`PATCH /api/projects/[id]/directory/[contactId]`) — when `permission` changes on a `type='user'` contact whose email matches an existing user, the template is re-applied for that user/project. Clearing the template removes their per-tool overrides.
- `lib/apply-permission-template.ts` exposes `applyPermissionTemplate({ companyId, projectId, userId, category, userType })` and `clearProjectToolPermissions(projectId, userId)`.
- The directory contact's `permission` string is mapped to `(category, user_type)` via `templateNameToCategoryAndType()` in `lib/permission-templates.ts`. Tool display names are mapped to project-tool slugs via `TOOL_NAME_TO_SLUG`.
- Resolution still follows `getToolLevel`: explicit `project_tool_permissions` row > role default > none. Company admins (super_admin / admin) on the owning company always evaluate to `admin` regardless of any template row, to prevent self-lockout.

## RFI Tool – Admin-Only Mutations

### Overview
The RFIs tool restricts every mutation that changes RFI state to users with **Admin** level on the RFIs tool, with one carve-out for the **RFI creator**: the user who created an RFI keeps the same management affordances on that single record (Edit, Close/Reopen, Delete, Mark Official, Delete Response, Add/Remove Related Items, Create Change Event from RFI) even if they are not on the admin tier. Assignees, the distribution list, and the ball-in-court holder can still respond to the RFI (and return court) but cannot create, edit, close, delete, mark a response official, delete comments, or create change events from an RFI they do not own.

### Required Permission
- **Admin** on the RFIs tool. Per `getToolLevel`, that resolves to:
  - **Site Command Admin** acting in support context (when granted),
  - **Company Super Admin / Company Admin** on a project owned by their company,
  - **Project Admin** members,
  - or any user with an explicit `admin` row in `project_tool_permissions` for `tool = "rfis"`.
- Company Members default to **Standard** and External Collaborators default to **Read Only**; both are blocked from the actions below **unless** they are the RFI creator (in which case the creator carve-out grants them admin-equivalent access on that one RFI).

### Admin-Only Actions (admin OR RFI creator unless noted)
- **Create an RFI** (`POST /api/projects/[id]/rfis`) — strictly admin-only (the creator concept does not apply to a brand-new record).
- **Bulk update RFIs** (`POST /api/projects/[id]/rfis/bulk`) — strictly admin-only (the bulk endpoint can target RFIs across multiple creators, so it does not grant the creator carve-out).
- **Edit an RFI** (`PATCH /api/projects/[id]/rfis/[rfiId]`) — admin or the RFI creator; non-creators may still send a ball-in-court-only PATCH if they are the current holder.
- **Delete an RFI** (`DELETE /api/projects/[id]/rfis/[rfiId]`) — admin or the RFI creator.
- **Close / Reopen an RFI** — implemented as a status PATCH; same gate as Edit.
- **Mark a response as Official** — PATCH of `official_response_id`; same gate as Edit.
- **Delete a comment / response** (`DELETE /api/projects/[id]/rfis/[rfiId]/responses/[responseId]`) — admin, the RFI creator, or the response author.
- **Add / remove Related Items** on an RFI — backed by PATCH `related_items`; same gate as Edit.
- **Create a Change Event from an RFI** — the "Create Change Event" entry points on the RFI page are hidden from users who are neither admin nor RFI creator; the change-events tool retains its own permission gate at the API level.

### Non-Admin Actions Still Permitted
- **View** the RFI list and detail (subject to existing read access).
- **Add a response / comment** to the RFI (`POST /api/projects/[id]/rfis/[rfiId]/responses`).
- **Return Ball in Court** when the user is the current ball-in-court holder. Implemented as a `ball_in_court_id`-only PATCH with a server-side check that the caller matches the current holder (or is an admin).
- Email the distribution list (`POST /api/projects/[id]/rfis/[rfiId]/notify`) — notification, not a mutation of RFI state.

### Implementation Notes (SiteCommand)
- Permission helper: `requireToolLevel(session, projectId, "rfis", "admin")` from `lib/tool-permissions.ts` is called at the top of the strictly-admin endpoints (`POST /api/projects/[id]/rfis`, `POST /api/projects/[id]/rfis/bulk`).
- `PATCH /api/projects/[id]/rfis/[rfiId]`: resolves the tool level via `getToolLevel`. If `toolLevel !== "admin"`, it loads the RFI's `created_by` and lets the caller through when they are the creator (any field). Non-admin non-creators may still PATCH `ball_in_court_id` only, and only if they match the current holder (by `session.id` or by the holder contact's email).
- `DELETE /api/projects/[id]/rfis/[rfiId]`: admin OR `rfi.created_by === session.id`.
- `DELETE /api/projects/[id]/rfis/[rfiId]/responses/[responseId]`: admin OR RFI creator OR response author. The route reads `rfis.created_by` and `rfi_responses.created_by` to evaluate the gate.
- Client gates: `RFIDetailClient.tsx` derives `isAdmin = toolLevel === "admin"`, `isCreator = rfi.created_by === userId`, and `canManage = isAdmin || isCreator`. The header buttons, three-dot actions menu, Mark Official checkbox, Delete-Response button, and Related-Item add/remove all use `canManage`, so the RFI creator keeps the full management surface on records they own. `RFIsClient.tsx` keeps `isAdmin` for the New RFI button, the row Edit icon, the row selection checkboxes, and the bulk-edit toolbar (the list view does not have per-row creator context).
- `app/projects/[id]/rfis/page.tsx` resolves `getToolLevel(..., "rfis")` and passes it to `RFIsClient`. The detail page does the same and forwards both `toolLevel` and `userId` to `RFIDetailClient`.

## Transaction Orders – Assign Invoice Workflow

### Overview
A user with **Admin** tool level on Transaction Orders can route an invoice PDF to another project so its Project Manager (and any other directory contacts they pick) can convert it into a Transaction Order. Assigned invoices appear:
- on the target project's **Transaction Orders** page in an **Assigned Invoices** section, and
- on each recipient's dashboard under **My open items** as an "assigned invoice".

Recipients are also notified by email at assignment time.

### UI
- Button: **Assign Invoice** (gray outline) is rendered left of **New Transaction Order** on the Transaction Orders page when `toolLevel === "admin"`. Page-level computation lives in `app/projects/[id]/transaction-orders/page.tsx`.
- Modal: `AssignInvoiceModal` inside `TransactionOrdersClient.tsx`:
  - Project selector (loads `/api/projects` — already scoped to projects the user can access; for Company Super Admin / Admin this is every company project).
  - On project change, autoloads the project's **Project Manager** contact rows (`GET /api/projects/[id]/project-manager`) and the project directory.
  - **Additional recipients**: checkbox list of directory contacts (excluding the PM contacts and distribution_group entries; only contacts with an email show).
  - Invoice PDF picker + optional notes.
- Assignments list on the target project: status pill (Open / Completed), filename link to signed PDF, assigner + date, recipient names, and per-assignment **Mark Complete** (any recipient, the assigner, or a TO admin) and **Delete** (TO admin or assigner).

### API
- `GET /api/projects/[id]/project-manager` — returns `{ projectManagers: [{ contactId, name, email }] }` resolved from `projects.project_roles["Project Manager"]` → `directory_contacts`. Requires `admin` on `transaction-orders` for the target project (don't leak PM identity to unrelated viewers).
- `GET /api/projects/[id]/transaction-orders/assignments/upload-url?filename=…` — signed PUT URL into `project-drawings/{projectId}/_assignments/{ts}-{filename}`. Requires `admin` on Transaction Orders for the target project.
- `GET /api/projects/[id]/transaction-orders/assignments` — list assignments for a project (signed download URLs included). Visible to anyone with at least `read_only` on Transaction Orders.
- `POST /api/projects/[id]/transaction-orders/assignments` — admin-only on target project. Body: `{ filename, storagePath, notes?, recipients: [{ contactId, name, email, role }] }`. The route validates the storagePath is under `{projectId}/_assignments/`, backfills `userId` on recipients by matching `users.email`, persists the row, then fires `sendInvoiceAssignmentEmail` (non-fatal on failure).
- `PATCH /api/projects/[id]/transaction-orders/assignments/[assignmentId]` — `{ status: "open" | "completed" }`. Allowed for: TO admin on the target project, the original assigner, or any current recipient (matched by `userId` or `email`). Sets `completed_at` / `completed_by` when moving to `completed`.
- `DELETE /api/projects/[id]/transaction-orders/assignments/[assignmentId]` — TO admin or assigner only. Best-effort removes the storage file.

### Storage / Schema
- Table `transaction_order_assignments` (migration `132_transaction_order_assignments.sql`):
  - `id`, `project_id` (target), `assigned_by`, `invoice_filename`, `invoice_storage_path`, `notes`, `recipients JSONB`, `status` (default `open`), `created_at`, `completed_at`, `completed_by`.
  - `recipients` shape: `[{ contactId, userId | null, email, name, role }]`. `userId` is resolved at create time from `users.email` so the dashboard query can match efficiently.
- Storage path: `project-drawings/{projectId}/_assignments/{ts}-{safeFilename}` (existing bucket, no new bucket needed).

### Dashboard Open Items
- `app/api/dashboard/my-tasks/route.ts` adds a new `OpenItem` type: `transaction_order_assignment`.
- The route queries `transaction_order_assignments` where `status = 'open'` and filters in-memory to rows whose `recipients` include the current user (by `userId === session.id` or `email === session.email`).
- `app/dashboard/DashboardClient.tsx`:
  - `MyOpenItem.type` includes `transaction_order_assignment`.
  - `openItemHref` routes to `${projectBase}/transaction-orders`.
  - The pill label special-cases the long type to render as **"assigned invoice"**.

### Email
- `sendInvoiceAssignmentEmail({ to, projectName, invoiceFilename, notes, projectUrl, assignedBy })` in `lib/email.ts`. Uses Resend; no-ops without `RESEND_API_KEY`. The `to` is the full recipient list (CC is not used here since everyone in `to` is an intended recipient, not a copy).

## Permit Applications – AI-Assisted Form Filling

### Overview
A project-level tool for completing permit application PDFs. The user uploads a blank permit form and gives it a title; Gemini scans the form for every fillable field and proposes a value for each by searching project data (address, city, state, contacts, phone numbers, etc.); the user reviews and edits the proposed values; and on approval the filled PDF is downloaded and saved under a **Completed Permit Applications** section.

### Tool-Level Permissions
- **Read Only** – can view the Completed Permit Applications list.
- **Standard / Admin** – can upload, scan, review, and approve permit applications.
- Delete is allowed for a Permit Applications **Admin** or the user who created the record.
- The tool slug is `permit-applications`; the page redirects to the project home when the resolved tool level is `none`.

### Workflow
1. Open the project's **Permit Applications** tool.
2. Enter a **Title** and click **Upload Permit Application** to choose a PDF (the title defaults to the filename when left blank).
3. Gemini scans the form, then the PDF itself is rendered under **Review & Edit on the Form** with each proposed value sitting in a **yellow editable box** exactly where it will appear on the saved PDF. Every box is editable in place; checkboxes toggle on click.
4. Click **Approve & Download Permit Application** — the completed PDF downloads and is added to **Completed Permit Applications** (title is a hyperlink that opens the PDF in a new tab).

### In-PDF Editing Preview
- After a scan, `PdfFieldEditor` renders every page of the uploaded PDF with `pdfjs-dist` (legacy build, worker at `public/pdf.worker.min.mjs`) and overlays an editable yellow box on each field returned by the scan.
- Box positions come from the scan response: flat fields carry `drawX`/`drawY`/`drawW`/`drawMode` (text-layout coordinates); AcroForm fields carry a `rect` (the widget rectangle). All coordinates are normalized 0–1, so overlays are positioned with a `ResizeObserver`-measured page width and stay correct at any display size.
- Editing a box calls back into `PermitApplicationsClient` (`updateField`), so the value the user sees on the form is exactly what `fillPermitApplication` writes on approve — the preview is faithful.
- AcroForm scans return **every** form field as a positioned PermitField (filled or empty), so the user always edits on the rendered form — there is no separate "other fields" list under the PDF.

### Filling Behavior
- When the PDF has interactive **AcroForm** fields, `extractAcroFormPlacements()` walks `form.getFields()` and reads each widget's rectangle via pdf-lib's widget API (no `T`/`Parent` chain heuristics), producing one placement per field name with a guaranteed position. Gemini sees a numbered list of those fields (`Field N | name="..." | type=...`) plus the PDF as visual context, and returns `{ fieldNum, label, value }` for the ones it can fill. The processor emits one PermitField per placement so unfilled fields still appear on the form for the user to fill manually.
- When the PDF has **no** AcroForm fields (a flat/scanned form), `extractTextLayout()` reads every text item and its exact coordinates with `pdfjs-dist`; Gemini receives a **numbered list** of those items and returns, per fill action, a `fieldNum` (integer index — impossible to hallucinate), a `value`, and a `drawMode` (`fill` = right of label, `fill_below` = below label, `check` = X to the left of an option). `resolveDrawPosition()` converts the chosen item + drawMode into deterministic draw coordinates.
- `fillPermitApplication()` writes values into the AcroForm and flattens, then draws flat-PDF text and checkbox "X"s directly onto the original pages, honoring `drawW` for text width.
- The appended summary page is only a **last-resort fallback** — used for any field with no resolvable position and no AcroForm mapping.

### Implementation Notes (SiteCommand)
- Processor: `lib/permit-application-processor.ts` — `extractAcroFields()` (pdf-lib AcroForm inspection, used to detect flat vs AcroForm), `extractAcroFormPlacements()` (per-field widget rectangles via `field.acroField.getWidgets()`), `extractTextLayout()` (pdfjs text + coordinates), `scanPermitApplication()` (Gemini `gemini-2.5-flash`: AcroForm numbered-field+vision path or flat numbered-field path), `resolveDrawPosition()`, `fillPermitApplication()` (AcroForm fill + flatten → coordinate overlay → summary-page fallback), `normalizePermitFields()` (validate the field payload coming back from the client).
- Both scan paths use a structured-output schema (`responseSchema` + `responseMimeType: "application/json"`). The AcroForm path additionally passes the PDF to Gemini as inline base64 so it can map field names to visual labels. `scan` and `approve` routes set `maxDuration = 120`.
- Requires `GEMINI_API_KEY` (same key used by Transaction Orders and other AI features).
- API routes under `app/api/projects/[id]/permit-applications/`:
  - `GET /` — list completed permit applications with fresh 1-hour signed URLs (read_only+).
  - `POST /scan` — multipart `file`; reads AcroForm fields, builds project context, runs Gemini; returns `{ fields, hasAcroForm }` where each field carries its draw position (standard+). Nothing is persisted.
  - `POST /approve` — multipart `file` + `title` + `fields`; fills the PDF, uploads it, inserts the record, and streams the filled PDF back for download (standard+).
  - `DELETE /[permitId]` — admin or record creator; removes the row and the stored PDF.
- Project context fed to Gemini (`buildProjectContext` in `scan/route.ts`): project fields (name/address/city/state/zip/county/number/sector/value/dates), company name, directory contacts (name/email/phone/company/job title/address/license), contacts tagged with the **Project Manager** role, recent **RFIs** (number/subject/question/status/drawingRef), recent **submittals** (number/title/type/status/costCode/description), the project's **drawings** list (drawing_no/title/revision/date), **specifications** list (spec_number/title), and the last 10 **daily logs** (date/weather/notes/crewCount).
- Storage: completed PDFs live in the existing `project-drawings` bucket under `{projectId}/_permit-completed/...`.
- Database: `project_permit_applications` (migration `140_permit_applications.sql`) — `title`, `source_filename`, `final_filename`, `final_storage_path`, `fields` JSONB, `created_by`, `created_at`.
- UI: `app/projects/[id]/permit-applications/PermitApplicationsClient.tsx` (page shell, upload, completed list) and `PdfFieldEditor.tsx` (in-PDF rendering + yellow editable overlays).

## Tasks – AI "To Do" Recommendations

### Overview
The Tasks page has a **To Do** section above the tasks table that surfaces AI-recommended action items. A daily cron at ~4am ET generates recommendations per project so the team sees a fresh list when they log on. Recommendations are grounded in the project's recent signals — linked **emails**, where the project sits in its **schedule** (with typical/known construction lead times), open RFIs/submittals, change events, meetings, daily logs, and punch list — and surface time-sensitive work (long-lead procurement, submittals needing approval before fabrication, inspections to book ahead, email action items, etc.).

### User Actions (per recommendation)
- **Accept** — spawns a real task (status `initiated`, title/category/due date carried over, rationale becomes the description) and removes the card.
- **Ignore** — dismisses permanently (never resurfaces; deduped against on future runs).
- **Later** (snooze) — resurfaces after **1 day**, **1 week**, or **2 weeks**.
- **Refresh** — manually triggers a generation pass (same logic as the cron) instead of waiting for the morning.

### Tool-Level Permissions
- Any user who can access the project (`canAccessProject`) can view and act on recommendations, matching the existing Tasks tool (which gates on project access, not a per-tool level).

### Generation & Dedupe
- Shared generator: `lib/todo-recommendations.ts` → `generateTodoRecommendations(supabase, projectId)`. Builds a lean project context (generic row serialization for RFIs, submittals, meetings, daily logs, schedules, change events/orders, commitments, punch list, transmittals + a dedicated fuller email block) and calls Gemini `gemini-2.5-flash` with a structured-output schema (`{ items: [{ title, rationale, source, category, priority, suggestedDueDate }] }`).
- **Dedupe**: each title is normalized into a `dedupe_key` (lowercase, alphanumeric, collapsed whitespace); `UNIQUE(project_id, dedupe_key)` plus an in-generator check against ALL existing rows (any status) means a recommendation already seen/accepted/ignored is never re-suggested.
- **Caps**: stops generating once a project has `MAX_ACTIVE_RECOMMENDATIONS` (12) actionable items; inserts at most `MAX_NEW_PER_RUN` (6) per pass. Existing open tasks and prior recommendations are passed to the model so it won't duplicate them.

### Schedule (Cron)
- `vercel.json` cron `/api/cron/todo-recommendations` at `0 8 * * *` (~4am ET / before the workday). Secured with `CRON_SECRET`. Iterates `projects` where `status = 'active'` and calls the shared generator; resilient to per-project failures. Requires `GEMINI_API_KEY`.

### API
- `GET /api/projects/[id]/todo-recommendations` — active list (`status = 'pending'` AND not currently snoozed: `snoozed_until` null or ≤ now), sorted high→medium→low then newest first.
- `POST /api/projects/[id]/todo-recommendations` — manual generation pass, returns the refreshed active list (`maxDuration = 120`).
- `PATCH /api/projects/[id]/todo-recommendations/[recId]` — body `{ action: "accept" | "ignore" | "snooze", snooze?: "1d" | "1w" | "2w" }`. Accept creates the task and links `accepted_task_id`; rejects if the recommendation is no longer `pending` (409).

### Schema
- `project_todo_recommendations` (migration `152_project_todo_recommendations.sql`): `title`, `rationale`, `source`, `category`, `priority` (high/medium/low), `suggested_due_date`, `status` (pending/accepted/ignored), `snoozed_until` (future = hidden until then), `dedupe_key` (UNIQUE per project), `accepted_task_id`, `acted_by`/`acted_at`, `generated_at`.

### UI (SiteCommand)
- `TasksClient.tsx`: `TodoSection` + `TodoCard` render above the stat strip. Each card shows priority badge, title, category, rationale, source label, and suggested due date, with Accept / Later (snooze dropdown) / Ignore controls. State: `recommendations`, `recsLoading`, `recsRefreshing`, `recBusyId`; handlers `handleRefreshRecs` and `actOnRec`. The section hides while the first load is in flight and renders an empty hint (with Refresh) when there are no items.

## Assist – "Looking Ahead" Daily Briefing

### Overview
The Assist page has a **Looking Ahead** section (above the chat box) that surfaces a daily briefing of **things to know / remember** given where the project currently stands. A daily cron (~3am ET) studies the project — drawings/plans, specs, contracts/commitments, recent emails, schedule position, open RFIs/submittals, meetings, daily logs, change events/orders, punch list, transmittals — and writes a few grounded factual bullets the team should keep top of mind.

These are **facts to commit to memory, not action items** (actionable to-dos live in the Tasks "To Do" section). Example notes: "The stormwater plans show 1,240 LF of 24\" RCP on site" or "Per the supplier's May 3 email, structure C15 will be ~2 weeks late."

### User Actions (per note)
- **Pin / Unpin** — keep an important fact at the top of the list (pinned notes sort first).
- **Dismiss** — hide permanently (deduped against on future runs, never resurfaces).
- **Later** (snooze) — resurfaces after **1 day**, **1 week**, or **2 weeks**.
- **Refresh** — manually triggers a generation pass (same logic as the cron) instead of waiting for the morning.

### Tool-Level Permissions
- Any user who can access the project (`canAccessProject`) can view and act on notes — same gate as the rest of the Assist page (no per-tool level).

### Generation & Dedupe
- Shared generator: `lib/looking-ahead.ts` → `generateLookingAheadNotes(supabase, projectId)`. Builds a lean project context (generic row serialization for drawings, specs, commitments, RFIs, submittals, meetings, daily logs, schedules, change events/orders, punch list, transmittals + a dedicated fuller email block) and calls Gemini `gemini-2.5-flash` with a structured-output schema (`{ items: [{ headline, detail, source, category, priority }] }`).
- **Dedupe**: each headline is normalized into a `dedupe_key` (lowercase, alphanumeric, collapsed whitespace); `UNIQUE(project_id, dedupe_key)` plus an in-generator check against ALL existing rows (any status) means a note already seen/pinned/dismissed is never re-surfaced.
- **Caps**: stops generating once a project has `MAX_ACTIVE_NOTES` (10) actionable notes; inserts at most `MAX_NEW_PER_RUN` (6) per pass. Previously surfaced headlines are passed to the model so it won't repeat them. The system prompt explicitly forbids action-item phrasing ("call the supplier") and requires facts ("structure C15 is ~2 weeks late") grounded in the provided data.

### Schedule (Cron)
- `vercel.json` cron `/api/cron/looking-ahead` at `0 7 * * *` (~3am ET / before the workday and before the To Do cron at 8 UTC). Secured with `CRON_SECRET`. Iterates `projects` where `status = 'active'` and calls the shared generator; resilient to per-project failures. Requires `GEMINI_API_KEY`.

### API
- `GET /api/projects/[id]/looking-ahead` — active list (`status = 'pending'` AND not currently snoozed: `snoozed_until` null or ≤ now), sorted pinned-first then high→medium→low then newest first.
- `POST /api/projects/[id]/looking-ahead` — manual generation pass, returns the refreshed active list under `notes` (`maxDuration = 120`).
- `PATCH /api/projects/[id]/looking-ahead/[noteId]` — body `{ action: "pin" | "unpin" | "dismiss" | "snooze", snooze?: "1d" | "1w" | "2w" }`. Rejects if the note is no longer `pending` (409).

### Schema
- `project_looking_ahead_notes` (migration `153_project_looking_ahead_notes.sql`): `headline`, `detail`, `source`, `category`, `priority` (high/medium/low), `status` (pending/dismissed), `pinned` (bool), `snoozed_until` (future = hidden until then), `dedupe_key` (UNIQUE per project), `acted_by`/`acted_at`, `generated_at`.

### UI (SiteCommand)
- `AssistClient.tsx`: a `LookingAheadCard` component plus a **Looking Ahead** `<section>`. Each card shows priority badge, headline, category, detail, source label, and a Pinned marker, with Pin/Unpin · Later (snooze dropdown) · Dismiss controls. State: `notes`, `notesLoading`, `notesRefreshing`, `noteBusyId`; handlers `refreshNotes` and `actOnNote`. The section renders an empty hint (with Refresh) when there are no notes. Pin/unpin updates in place; dismiss/snooze optimistically removes the card and reverts on failure.

## Assist – Page Layout (Navigation Tree)

### Overview
The Assist page uses a left **navigation tree** (same sticky `border-l-2` active-item style as the Project Admin settings page) to jump between three stacked sections. `ASSIST_SECTIONS` in `AssistClient.tsx` defines the order, and an `IntersectionObserver` (matching the AdminClient pattern) highlights the section currently in view; `jumpToSection` smooth-scrolls on click.

### Sections (top → bottom)
1. **Discover** (`id="discover"`) — the "What would you like to know about this project?" ask box **and** the question History live together **in the same tile** (one `card`): the chat scroll area + input on top, a `History` sub-panel beneath a divider in the same card.
2. **Recurring Workflows** (`id="recurring-workflows"`) — the create form + saved workflow list.
3. **Looking Ahead** (`id="looking-ahead"`) — the daily-briefing notes (see section above).

### Recurring Workflows – Output Document Type
- Each recurring workflow chooses an output **Document type**: **PDF** (default) or **Word**, selected in the create form (`wfDocumentType` state) and shown as a pill on each workflow row.
- Persisted in `assist_recurring_workflows.document_type` (migration `156_assist_recurring_workflow_document_type.sql`, `CHECK IN ('pdf','word')`, default `'pdf'`). The reports `file_type` CHECK is widened to also allow `'word'`.
- API: `POST /api/projects/[id]/assist/recurring-workflows` validates `documentType` against `ALLOWED_DOCUMENT_TYPES` and stores it; `GET` returns it as `documentType`.
- Cron (`/api/cron/assist-recurring-workflows`) reads `document_type` and writes the report artifact accordingly: a `.doc` (msword-MIME HTML data URL, `file_type='word'`) for Word, or the existing markdown data URL (`file_type='pdf'`) for PDF.

## Project Admin – Super-Admin-Only Settings

### Permission Model
- **Every** project setting on the Project Admin page is editable by **Company Super Admins only**. The single exception is **team member management** (add/remove), which remains available to any Company Admin (`super_admin` or `admin`) because both resolve to `project_admin` via `getProjectRole`.
- In `AdminClient.tsx`: `isSuperAdmin = role === "super_admin"` gates all form fields (General Information, Project Location, Building Code, ERP Integration, Advanced, Dates, and the Report Fields block — wrapped in a `<fieldset disabled={!isSuperAdmin}>`). `isAdmin = admin || super_admin` is now used only for the Project Members add/remove controls. The **Save Changes** button + "Admin controls" pill render only for super admins; a regular admin sees a note that they may only manage team members.
- Server enforcement: `PATCH /api/projects/[id]/admin` requires `company_role === "super_admin"` for all fields. The building-code mutation endpoints (`POST` documents, `PATCH`/`DELETE` a document, `POST suggest`, `GET upload-url`) were tightened from admin-or-super to **super-admin-only** to match the page (viewing via `GET` still uses `canAccessProject`).
- The ERP Integration and Advanced sections each carry a permanent note under the title stating that only Company Super Admins can change those settings.

### Labor Productivity Toggle
- New **Labor Productivity for Budget, Change Events, and Change Orders** checkbox in the **Advanced** section — a project-financials capability flag (see "Enable Labor Productivity Cost Features").
- Persisted in `projects.labor_productivity` (migration `159_project_labor_productivity.sql`, BOOLEAN default false). Added to the admin `GET` select, the `PATCH` allowed list, and the `laborProductivity` state in `AdminClient.tsx`.

### Copy Directory From
- The **Copy Directory From** control in the Advanced section is a real dropdown of **all other company projects, active and archived** (current project excluded), plus a **Copy Directory** button. Super-admin-only.
- API `/api/projects/[id]/copy-directory`:
  - `GET` — lists sibling company projects as `{ projects: [{ id, name, archived }] }` (archived flag from `projects.archived_at`).
  - `POST` `{ sourceProjectId }` — copies `directory_contacts` from the source project into the current one, **deduping by email** (emailless contacts deduped by a type/group/name/company signature). Non-destructive: only inserts, never deletes, so it is safe to re-run. Returns `{ copied }`.
  - Both endpoints require `super_admin` and verify both projects belong to the caller's company.

## QuickBooks Online (QBO) Integration

### Overview
Per-company OAuth connection to QuickBooks Online (and Intuit Enterprise Suite tenants). Push-sync of commitments (subcontract → **Bill**, purchase order → **PurchaseOrder**), prime contracts (→ AR **Invoice**), and AP/AR billing from SOV amounts, with vendor/customer auto-creation and idempotent updates. Read-only pulls: active Vendor/Customer lists. Docs: `docs/quickbooks-online-setup-guide.md` (user setup walkthrough), `docs/quickbooks-online-integration.md` (runtime reference), `docs/quickbooks-online-data-mapping.md` (field crosswalk).

### Environments (Sandbox vs Production)
- Per-company **Environment** selector on Settings → Integrations (stored as `QBO_ENVIRONMENT` row in `company_integrations`; values `sandbox` | `production`, validated in the PATCH route). Falls back to the `QBO_ENVIRONMENT` env var, default production. `QBO_API_BASE` env overrides both.
- Sandbox requires Intuit **Development** keys; production requires **Production** keys. OAuth authorize/token URLs are identical across environments — only the REST base differs (`sandbox-quickbooks.api.intuit.com` vs `quickbooks.api.intuit.com`).
- UI shows a blue **Sandbox** badge next to the Connected pill when sandbox is selected.

### Connection Flow
- `GET /api/integrations/quickbooks/connect` (super_admin/site_admin) → Intuit consent → `GET /api/integrations/quickbooks/callback` → tokens upserted to `company_integrations` (`QBO_REALM_ID`, `QBO_ACCESS_TOKEN`, `QBO_REFRESH_TOKEN`).
- **CSRF**: connect sets a 10-min httpOnly `qbo_oauth_state` nonce cookie and embeds the nonce in OAuth `state`; callback rejects on mismatch (`qbo_invalid_state`) and always clears the cookie.
- **Redirect URI**: `getIntuitRedirectUri()` precedence `INTUIT_REDIRECT_URI` > `NEXT_PUBLIC_APP_URL` + callback path > request-derived. Must byte-for-byte match the URI registered in the Intuit portal. The settings GET (`?integration=quickbooks`) returns the computed value as derived field `QBO_REDIRECT_URI` so the UI shows exactly what the server sends. Post-OAuth browser redirects use `getAppOrigin()` (prefers `NEXT_PUBLIC_APP_URL`) so users land on the canonical domain.
- `POST /api/integrations/quickbooks/disconnect` (super_admin) — best-effort revokes the refresh token via Intuit's revoke endpoint (`revokeQBOToken` in `lib/quickbooks.ts`), then deletes the realm/token rows; keeps Client ID/Secret + environment. UI **Disconnect** button next to Reconnect.

### Credential Resolution
- App creds (`getQBOAppCredentials(companyId)`): `company_integrations` → `platform_settings` → env. All call sites (sync, cron, vendors, customers) pass `companyId` so token refresh uses the same app the tokens were issued by.
- Tokens auto-refresh on 401 (one retry) and persist back to `company_integrations`.

### Sync Surfaces
- Manual: **Sync to QuickBooks** button on commitment + prime contract detail headers → `POST /api/integrations/quickbooks/sync` `{ recordType: commitments|prime_contracts|ap_invoice|ar_invoice, recordId }`.
- Cron: `GET /api/cron/quickbooks-sync` daily 17:00 UTC (vercel.json), `CRON_SECRET`-gated; pushes dirty rows (updated_at > last_synced_at), capped 25/type/company.
- Idempotency: `qbo_id`/`qbo_sync_token`/`last_synced_at` (+ `qbo_ap_invoice_*`, `qbo_ar_invoice_*`) from migration `113_qbo_idempotency_columns.sql`; updates re-fetch the live SyncToken and POST `?operation=update` with `sparse: true`; deleted-on-QBO records are recreated.
- Posting config (per-company keys or env): `QBO_AP_EXPENSE_ACCOUNT`, `QBO_DEFAULT_ITEM`, `QBO_BUDGET_CODE_MAP` (JSON code → account/class/item), `QBO_RETAINAGE_RECEIVABLE_ACCOUNT`, `QBO_RETAINAGE_PAYABLE_ACCOUNT`, `QBO_PROJECT_TRACKING` (`none` disables the project-Class line fallback; default on), `QBO_DOC_NUMBER_PREFIX` (`project` → `{project_number}-{number}` DocNumbers, any other value = literal prefix, 21-char cap). All refs post by **Id**, never name; sync fails fast when no valid account/item resolves.
- Mapping completeness (see `docs/quickbooks-online-data-mapping.md` §7): auto-created Vendors/Customers are **enriched** from the matching directory contact (`lookupDirectoryPartyDetails` — company/email/phone/fax/website/address); `payment_terms` → `SalesTermRef` on exact active-Term match (else kept in PrivateNote); PO `ship_to` → `ShipAddr`, `delivery_date` → `DueDate`, `ship_via`/`bill_to` → PrivateNote; lump-sum fallback posts the **revised** amount (original + approved COs) on both commitments and prime contracts; AR invoices bill **stored materials** as a dedicated line; void/terminated records → Bill **delete** / PO **POStatus=Closed** / Invoice **void** (`QBOResult.action`: `deleted`/`closed`/`voided`/`skipped`; routes clear `qbo_id` + feedback columns on delete/skip and set `last_synced_at` so the cron stops retrying).
- Accounting feedback (migration `161_erp_accounting_feedback_columns.sql`): every sync parses `TotalAmt`/`Balance` (+ PO `POStatus`) from the response into `qbo_total_amount`/`qbo_balance`/`qbo_payment_status` (`paid`/`partially_paid`/`unpaid`, or lowercased POStatus), plus `qbo_ap_invoice_*` / `qbo_ar_invoice_*` and `qbo_vendor_id`/`qbo_customer_id`. `POST /api/integrations/quickbooks/refresh` `{ recordType, recordId }` re-reads on demand (`fetchQBOEntityFinancials`); the cron also runs a payment-refresh pass (25 stalest synced records per table per company, ordered by `qbo_payments_refreshed_at`). Surfaced in an **Accounting** section on the commitment + prime-contract detail pages with a "Refresh payment status" button.
- Required record fields: commitments need **Contract Company** (QBO vendor), prime contracts need **Owner/Client** (QBO customer). Blank values fail fast with `validation: true` on the QBOResult → the sync route returns **422** with an actionable message (vs 502 for QBO-side errors). Vendor/customer resolution failures (`findOrCreateVendorId`/`findOrCreateCustomerId` return `QBORefLookup`) include QBO's underlying fault in the error string.
- Record-fetch failures in the sync route are no longer masked as 404: PGRST116 (zero rows) → 404, any other DB error → 500 with the message (e.g. missing migration-113 columns).
- Logs: every attempt → `erp_sync_logs` (`integration='quickbooks'`); per-record via `GET /api/integrations/quickbooks/logs`.

### Verification
- Offline check: `npx tsx scripts/qbo-integration-check.ts` — mocked-fetch assertions for env routing, minorversion separators, 401 refresh+retry+persist, subcontract→Bill create payload (vendor enrichment, terms, project Class, financial feedback), idempotent revised-amount update, AR retainage + stored-materials lines, redirect-URI precedence, PO ship-to mapping, void/close/delete handling, DocNumber project prefix. Run after touching `lib/quickbooks.ts`.

## Sage 300 CRE Integration (via Agave)

### Overview
Per-company integration that syncs commitments (subcontract/PO → **Purchase Order**), prime contracts (→ **AR Invoice**), and AP/AR billing from SOV amounts to **Sage 300 CRE** (Construction & Real Estate, formerly Timberline). Sage 300 CRE is an **on-premise** Windows system with **no native cloud REST API**, so SiteCommand reaches it through **Agave** (`https://api.agaveapi.com`) — a unified connector that runs an agent on the customer's Sage server and exposes a normalized cloud REST API. Docs: `docs/sage-300-cre-integration.md`.

> The `SageNADev/Sage300-SDK` repo is the *Sage 300 (Accpac) Web SDK* — a UI-screen toolkit for a **different** product (not CRE) with no external data API. Agave is the real connectivity layer for on-premise Sage 300 CRE. The existing `lib/sage-intacct.ts` is **Sage Intacct**, yet another separate Sage product — hence this integration uses the distinct `sage300cre` namespace.

### Auth model (Agave)
- App creds (resolve company → platform → env, like QBO): `SAGE300CRE_CLIENT_ID`, `SAGE300CRE_CLIENT_SECRET` → sent as `Client-Id` / `Client-Secret` headers.
- Per-company connection: `SAGE300CRE_ACCOUNT_TOKEN` (in `company_integrations`) → `Account-Token` header. Constant `API-Version: 2021-11-21`.
- `isSage300CreConnected` = app creds + account token. Helpers in `lib/sage300cre.ts`.

### Connect flow (Agave Link)
- `POST /api/integrations/sage300cre/connect` (super_admin/site_admin) → Agave `POST /link/token/create` → returns a `linkToken`.
- The user runs Agave Link (selects "Sage 300 CRE"), gets a `public_token`, then `POST /api/integrations/sage300cre/exchange` `{ publicToken }` → Agave `POST /link/token/exchange` → stores `SAGE300CRE_ACCOUNT_TOKEN`.
- `POST /api/integrations/sage300cre/disconnect` clears the account token (keeps app creds). Manual Account-Token paste is supported as a fallback in the UI.
- UI: `Sage300CreSection` (company) + `Sage300CreAppSection` (site_admin) in `IntegrationsClient.tsx`.

### Sync surfaces
- Manual: **Sync to Sage 300 CRE** button on commitment + prime contract detail headers (next to the QuickBooks button) → `POST /api/integrations/sage300cre/sync` `{ recordType: commitments|prime_contracts|ap_invoice|ar_invoice, recordId }`.
- Cron: `GET /api/cron/sage300cre-sync` daily 18:00 UTC (vercel.json, staggered after QBO), `CRON_SECRET`-gated; pushes dirty rows (`updated_at > sage300cre_synced_at`), capped 25/type/company.
- Mapping: commitment → `POST/PUT /purchase-orders` (revised amount, `due_date` from delivery/estimated completion); ap_invoice → `/ap-invoices` (`retention_amount` = billed × default retainage %); prime/ar_invoice → `/ar-invoices` (`due_date` from estimated completion; per-line retainage rolls up to `retention_amount`). Vendors/customers resolved **by name** via `GET /vendors|/customers` — sync fails fast (no auto-create) when the party isn't already in Sage 300 CRE (the ERP is the system of record). AR is connector-dependent; unsupported resources surface as logged errors.
- Job costing: the project resolves to a Sage **job** (`GET /jobs`, project number first then name → `resolveSage300CreJobId`) and SOV budget codes resolve to Sage **cost codes** (`GET /cost-codes`, exact code then name). Resolved ids post as header + per-line `job_id` / `cost_code_id`; unresolved values are omitted (budget code stays folded into the line description). Lines with consistent qty × unit cost also carry `quantity`/`unit_cost`/`unit_of_measure`. Jobs/cost codes are never auto-created.
- Accounting feedback (migration `161_erp_accounting_feedback_columns.sql`): sync responses parse `amount`/`amount_paid`/`balance`/`status` (bare or `data`-wrapped) into `sage300cre_status` + `sage300cre_vendor_id` on commitments (header PO is non-posting → status only), `sage300cre_ap_invoice_total_amount`/`_amount_paid`/`_balance`/`_status` for AP invoices, and the header + `sage300cre_ar_invoice_*` quartets on prime contracts (+ `sage300cre_customer_id`). `POST /api/integrations/sage300cre/refresh` re-reads on demand (`fetchSage300CreRecordFinancials`); the cron runs a payment-refresh pass (25 stalest per table per company by `sage300cre_payments_refreshed_at`). Shown in the **Accounting** section of the detail pages.
- Idempotency: `sage300cre_id`/`sage300cre_synced_at` (+ `sage300cre_ap_invoice_*`, `sage300cre_ar_invoice_*`) from migration `160_sage300cre_idempotency_columns.sql`. Agave has no SyncToken — updates `PUT /{resource}/{id}`; a 404 (deleted on Sage) falls back to create. Columns sit alongside the `qbo_*` ones so a record can sync to both ERPs independently.
- Logs: every attempt → `erp_sync_logs` (`integration='sage300cre'`); per-record via `GET /api/integrations/sage300cre/logs`.

### Verification
- Offline check: `npx tsx scripts/sage300cre-integration-check.ts` — mocked-fetch assertions for Agave headers/base URL, link create+exchange, vendor resolution + "not found" guard, Purchase Order create payload (job + cost-code resolution, quantity detail, due date), idempotent PUT + 404→recreate fallback, AR invoice revised-amount + due date, AP retention + financial feedback parsing, AR retention rollup. Run after touching `lib/sage300cre.ts`.
