# Nutrient.io (DWS API) — Integration Notes

Nutrient (formerly PSPDFKit) **Document Web Services (DWS) API** is a cloud API for
PDF processing — conversion, OCR, generation, watermarking/redaction, AI data
extraction, and PDF accessibility (auto-tagging / PDF/UA).

API keys are issued in the Nutrient dashboard and look like `pdf_live_...` (live)
or `pdf_test_...` (test). Requests are authenticated with a bearer token:

```
Authorization: Bearer <NUTRIENT_API_KEY>
```

Base URL: `https://api.nutrient.io/` (confirm the exact endpoint paths per product
in the Nutrient API docs at https://www.nutrient.io/api/).

## Environment Variables

We were issued four separate live keys, one per product area. Store each as its
own environment variable so future code can pick the right one per feature. These
are **secrets** — set them in Vercel (and in a local `.env.local` for dev), never
commit the values.

| Env var | Nutrient product | What it's for |
|---|---|---|
| `NUTRIENT_PROCESSOR_API_KEY` | Processor API | PDF build/convert, OCR, watermark, redact, flatten, merge/split |
| `NUTRIENT_DATA_EXTRACTION_API_KEY` | Data Extraction (AI) | Pull structured data out of documents (invoices, forms, etc.) |
| `NUTRIENT_ACCESSIBILITY_API_KEY` | PDF Accessibility | Auto-tag PDFs for PDF/UA / WCAG compliance |
| `NUTRIENT_LIVE_API_KEY` | General "Live" key | Default/fallback key for general DWS API calls |

> If Nutrient consolidates these into a single project key later, you can point all
> four vars at the same value — code should read the specific var for its feature.

## Where to add them

### Vercel (production / preview / development)
1. Vercel dashboard → the **SiteCommand** project → **Settings** → **Environment Variables**.
2. Add each variable above with its `pdf_live_...` value.
3. Select the environments it applies to (**Production**, **Preview**, **Development**).
4. **Save**, then **redeploy** so running deployments pick up the new values.

Or with the Vercel CLI (run locally, paste the secret when prompted):

```bash
vercel env add NUTRIENT_PROCESSOR_API_KEY production
vercel env add NUTRIENT_DATA_EXTRACTION_API_KEY production
vercel env add NUTRIENT_ACCESSIBILITY_API_KEY production
vercel env add NUTRIENT_LIVE_API_KEY production
# repeat with `preview` / `development` as needed, then: vercel --prod
```

### Local development
Add the same keys to `.env.local` (gitignored). See `.env.example` for the names.

## Usage convention (when we build the feature)
Read the keys via `process.env.*` in server code only (never expose to the client /
never prefix with `NEXT_PUBLIC_`), matching how `GEMINI_API_KEY`, `RESEND_API_KEY`,
etc. are used elsewhere in this codebase.
