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
| Task | Task (list edit) | 4 | 2 | 6 | API + loadSource wired; UI pending |
| Meeting | Meeting detail (autosave) | 3 | 1 | 4 | ✅ WIRED (violet section live) |
| Drawing | Drawing (extraction review) | 8 | 2 | 10 | API + loadSource wired; UI deferred |
| Folder/Document | Documents edit | 4 | 3 | 7 | DB stored; UI pending |
| Photo | (upload-managed) | 0 | 9 | 9 | DB-only storage |
| Specification Section | (parsed from spec book) | 0 | 7 | 7 | DB-only storage |
| Change Order (CCO/PCCO) | Change order detail | 8 | 8 | 16 | loadSource wired; UI pending |
| Prime Contract | Prime contract edit | 21 | 9 | 30 | ✅ WIRED (violet section live) |
| Budget Line Item | (budget grid) | 0 | 11 | 11 | DB-only storage |
| Timecard Entry | (timesheet grid) | 0 | 12 | 12 | DB-only storage |
| Change Event Line Item | (change-event grid) | 0 | 14 | 14 | DB-only storage |
| **TOTAL** | | **160** | **103** | **263** | |

## Notes on coverage

- The 263 fields above are the report columns that previously had **no backing
  data** but map to an entity that exists in the database.
- Report categories with **no underlying table at all** — Owner Invoice, Owner
  Invoice Line Item, Subcontractor Invoice, Payments Issued/Received, Employee,
  Labor Allocation, Production Quantities, ERP Job Costs, Invoice Compliance,
  Monitored Resource — are **not** in this chart; they require new tables + pages,
  not just a JSONB column.
- Where a report category's columns already resolved to real DB columns (e.g.
  Commitment number/status/amounts, Change Event title/status), those were
  already mapped and are untouched here.
