# 360 Report Field Mapping

How every previously-unmapped 360-report column is now backed by data. New fields
are stored in each entity's `report_fields` JSONB column (migration `157`),
surfaced on the relevant edit page in a **violet "Report Fields" section**
(`components/ReportFieldsSection.tsx`), and resolved back into report columns by
`loadSource()` in `Create360ReportClient.tsx`.

- **Visible** = rendered as an editable input in the violet section.
- **DB-only** = stored in `report_fields` and reportable, but no form input.

## Summary by entity

| Entity (report category) | Mapped to page | Visible | DB-only | Total | Status |
|---|---|--:|--:|--:|---|
| Project | Project Admin page | 50 | 8 | 58 | ✅ WIRED (violet section live) |
| Commitment | Edit Commitment page | 37 | 4 | 41 | ✅ WIRED (violet section live) |
| Company (Vendor) | Directory company edit | 6 | 2 | 8 | ✅ WIRED (violet section live) |
| RFI | RFI edit page | 8 | 8 | 16 | ✅ WIRED (violet section live) |
| Submittal | Submittal detail (inline edit) | 7 | 0 | 7 | ✅ WIRED (violet section live) |
| Punch Item | Punch item edit modal | 4 | 3 | 7 | ✅ WIRED (violet section live) |
| Task | Task detail modal | 4 | 2 | 6 | ✅ WIRED (violet section live) |
| Meeting | Meeting detail (autosave) | 3 | 1 | 4 | ✅ WIRED (violet section live) |
| Drawing | Drawing edit panel | 8 | 2 | 10 | ✅ WIRED (violet section live) |
| Folder/Document | Document Properties modal | 4 | 3 | 7 | ✅ WIRED (violet section live) |
| Photo | (upload-managed) | 0 | 9 | 9 | DB-only storage |
| Specification Section | (parsed from spec book) | 0 | 7 | 7 | DB-only storage |
| Change Order (CCO/PCCO) | Change order detail | 8 | 8 | 16 | ✅ WIRED (violet section live) |
| Prime Contract | Prime contract edit | 21 | 9 | 30 | ✅ WIRED (violet section live) |
| Budget Line Item | (budget grid) | 0 | 11 | 11 | DB-only storage |
| Timecard Entry | (timesheet grid) | 0 | 12 | 12 | DB-only storage |
| Change Event Line Item | (change-event grid) | 0 | 14 | 14 | DB-only storage |
| **TOTAL** | | **160** | **103** | **263** | |

## Source-less entities — Report Records (migration 158)

The 360-report categories that had **no underlying table at all** are now backed
by a single generic `report_records` table (one row per record, discriminated by
`entity` slug, all fields in `report_fields` JSONB). They are managed on a new
**Report Records** page (`/projects/[id]/report-records`, linked from the
Reporting page) and resolved into 360-report columns by `loadSource()`.

| Entity (slug) | Fields |
|---|--:|
| Owner Invoice (`owner-invoices`) | 53 |
| Owner Invoice Line Item (`owner-invoice-line-items`) | 54 |
| Subcontractor Invoice (`subcontractor-invoices`) | 65 |
| Subcontractor Invoice Line Item (`subcontractor-invoice-line-items`) | 48 |
| Payment Issued (`payments-issued`) | 4 |
| Payment Received (`payments-received`) | 4 |
| Employee (`employees`) | 10 |
| Labor Allocation (`labor-allocations`) | 5 |
| Actual / Budgeted / Budget-Change / Change-Event / PCCO Production Quantity | 7/5/6/5/6 |
| ERP Job Costs Summary (`erp-job-costs`) | 4 |
| Invoice Compliance (`invoice-compliance`) | 3 |
| Monitored Resource (`monitored-resources`) | 3 |
| Commitment CO Line Item / Markup | 38 / 10 |
| Prime Contract CO Line Item / Markup | 27 / 9 |
| Prime Contract Line Item (`prime-contract-line-items`) | 12 |
| Prime Contract Potential Change Order (`prime-contract-potential-change-orders`) | 28 |

**Total: 22 entities.** Every field is editable in the violet field UI on the
Report Records page and surfaces as a populated column in 360 Reports.

## Notes on coverage

- The 263 fields above are the report columns that previously had **no backing
  data** but map to an entity that already existed in the database.
- The 22 source-less entities (this section) are now fully backed via
  `report_records` — no remaining 360-report category returns an empty table.
- Where a report category's columns already resolved to real DB columns (e.g.
  Commitment number/status/amounts, Change Event title/status), those were
  already mapped and are untouched here.
