# MSME KFS Builder

Browser-based **Key Facts Statement (KFS)** generator for **MSME loans**, aligned with RBI **Annexure-A** under [RBI Circular RBI/2024-25/18 dated April 15, 2024](https://www.rbi.org.in/).

## Run online

**[Open MSME KFS Builder (GitHub Pages)](https://jugaad-online.github.io/MSME-Key-Facts-Statement/)**

No install required — open the link, fill the form, and use the live preview. Works on desktop and mobile (use the mobile toggle in the header).

## Run locally

1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox).

For the most reliable experience (print preview, some export features), serve over HTTP instead of `file://`:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`.

## What it produces

- **Part-1** — Loan, amount, disbursal, term, instalments, rate, fees, APR, contingent charges  
- **Part-2** — Other qualitative information  
- **Annexure-A(1)** — APR illustration  
- **Annexure-A(2)** — Repayment schedule (Actual/365 interest where dates are set)

The on-screen preview uses **A4-sized pages** so you can see approximate page count before export.

## Main features

| Area | Details |
|------|---------|
| **Loan products** | ECLGS 5.0, MSME Term Loan, Working Capital, CC/OD, Machinery, LAP, MUDRA, Stand-Up India, CGTMSE, etc., with indicative auto-fill profiles |
| **Rates** | Fixed, floating (benchmark + spread), hybrid (fixed then floating) |
| **Moratorium (MoP)** | Interest serviced monthly or capitalised; schedule labels for “Instalment during Moratorium” |
| **Dates** | Mandatory Date of Sanction; optional Date of Disbursement; sanction/disbursement consistency rules |
| **APR** | Auto-calculated (IRR / reducing balance); optional manual override |
| **Validation** | Mandatory fields for KFS readiness; GRO contact fields advisory (non-blocking) |
| **Export** | Download or share as **PDF**, **Word (.docx)**, or **Word (.doc)** via format chooser |
| **Print** | A4 print preview overlay and browser print / Save as PDF |
| **Bulk** | CSV template download and import (one row per loan) |
| **Persistence** | Form data auto-saved in the browser; reset card to restore defaults |

### Repayment tenure and averages

- **Repayment tenure (months)** — Number of equated instalment (EPI) periods **after** the MoP (typical core-banking EMI basis).  
- **MoP** — Additional months before EPIs start; total facility term shown on the KFS = repayment tenure + MoP.  
- **Average principal per month** — Total principal from the schedule ÷ (**Repayment tenure − MoP** months).  
- **Average interest per month** — Total interest from the schedule ÷ **Repayment tenure** months.

## Project files

| File | Purpose |
|------|---------|
| `index.html` | Form UI and layout |
| `kfs.js` | Calculations, validation, KFS HTML, export, CSV |
| `styles.css` | App, A4 preview, print and export styling |

Dependencies (CDN): **html2pdf.js**, **html-docx-js** for PDF/Word export.

## Quick start

1. Choose **Type of Loan** (optional auto-fill).  
2. Enter sanction amount, **Date of Sanction**, repayment tenure, rate, and fees.  
3. Click **Validate** (floating button).  
4. Use **Download**, **Share**, **Print preview**, or **Print**.

Use **?** on each field or the header **?** for the full guide.

## Repository

- **GitHub:** [jugaad-online/MSME-Key-Facts-Statement](https://github.com/jugaad-online/MSME-Key-Facts-Statement)  
- **Live app:** [https://jugaad-online.github.io/MSME-Key-Facts-Statement/](https://jugaad-online.github.io/MSME-Key-Facts-Statement/)

## Disclaimer

Illustrative tool based on the cited RBI circular. Verify against the latest RBI notifications and your institution’s policy before use.
