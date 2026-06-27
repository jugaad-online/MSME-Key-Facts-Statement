"use strict";

/* =================================================================
   Finance functions (Excel-equivalent)
   ================================================================= */
const Fin = {
  // Payment per period. Excel PMT returns a negative number for an outflow.
  pmt(rate, nper, pv, fv = 0, type = 0) {
    if (nper === 0) return 0;
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    return -(rate * (pv * pvif + fv)) / ((1 + rate * type) * (pvif - 1));
  },

  // Number of periods. Mirrors Excel NPER.
  nper(rate, pmt, pv, fv = 0, type = 0) {
    if (rate === 0) return -(pv + fv) / pmt;
    const num = pmt * (1 + rate * type) - fv * rate;
    const den = pv * rate + pmt * (1 + rate * type);
    return Math.log(num / den) / Math.log(1 + rate);
  },

  // Cumulative interest paid between period `start` and `end` (inclusive).
  // Returns a NEGATIVE number like Excel CUMIPMT.
  cumipmt(rate, nper, pv, start, end, type = 0) {
    const pay = this.pmt(rate, nper, pv, 0, type);
    let bal = pv;
    let interestSum = 0;
    for (let p = 1; p <= end; p++) {
      const interest = type === 0 ? bal * rate : 0;
      const principal = pay + interest; // pay is negative
      if (p >= start && p <= end) interestSum += interest;
      bal += principal;
    }
    return -interestSum;
  },

  // Effective rate per period via Newton-Raphson. Mirrors Excel RATE.
  rate(nper, pmt, pv, fv = 0, type = 0, guess = 0.1) {
    const MAX_ITER = 200;
    const EPS = 1e-10;
    let r = guess;
    for (let i = 0; i < MAX_ITER; i++) {
      let f, df;
      if (r === 0) {
        f = pv + pmt * nper + fv;
        df = pmt * nper * 0; // approximate; nudge away from 0 below
      } else {
        const t = Math.pow(1 + r, nper);
        f = pv * t + pmt * (1 + r * type) * (t - 1) / r + fv;
        // numerical derivative for robustness
        const h = 1e-6;
        const t2 = Math.pow(1 + (r + h), nper);
        const f2 = pv * t2 + pmt * (1 + (r + h) * type) * (t2 - 1) / (r + h) + fv;
        df = (f2 - f) / h;
      }
      if (!isFinite(df) || df === 0) { r += 1e-6; continue; }
      const rNext = r - f / df;
      if (Math.abs(rNext - r) < EPS) return rNext;
      r = rNext;
    }
    return r;
  },
};

/* =================================================================
   Helpers
   ================================================================= */
const num = (id) => {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(String(el.value || "").replace(/,/g, "")) || 0;
};
const str = (id) => {
  const el = document.getElementById(id);
  if (!el) return "";
  let v = (el.value || "").trim();
  // Dropdown set to "Other" -> read the companion free-text input.
  if (el.tagName === "SELECT" && v === "__other__") {
    const other = document.getElementById(id + "_other");
    v = other ? (other.value || "").trim() : "";
  }
  return v;
};
const trunc = (x) => Math.trunc(x);

// Render-time rounding step (in ₹) for ALL money amounts shown in the KFS / Annexures.
// 0 = show exact paise; 1/10/100 = round every amount to that nearest rupee step.
// Set by buildKfsHtml() from the loan's "Round off EPI / EMI" choice.
let KFS_ROUND_STEP = 0;
function fmtMoney(x) {
  if (x === "" || x === null || x === undefined || isNaN(x)) return "-";
  let v = Number(x);
  if (KFS_ROUND_STEP > 0) v = Math.round(v / KFS_ROUND_STEP) * KFS_ROUND_STEP;
  const dec = KFS_ROUND_STEP > 0 ? 0 : 2;
  return v.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(x) {
  if (x === "" || x === null || x === undefined || isNaN(x)) return "-";
  return (x * 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}
function addMonths(dateStr, months) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return "-";
  d.setMonth(d.getMonth() + months);
  return fmtDMY(d);
}
function fmtDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return "-";
  return fmtDMY(d);
}
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Format a Date as DD-MMM-YYYY (e.g. 31-Dec-2025).
function fmtDMY(d) {
  if (!d || isNaN(d)) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`;
}
// Date of the last calendar day of the month that is `monthsToAdd` months after baseDate.
function eomDate(baseDate, monthsToAdd) {
  if (!baseDate || isNaN(baseDate)) return null;
  // Day 0 of the following month === last day of the target month.
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsToAdd + 1, 0);
}
// Same, formatted as DD-MMM-YYYY.
function endOfMonthFrom(baseDate, monthsToAdd) {
  const d = eomDate(baseDate, monthsToAdd);
  return d ? fmtDMY(d) : "-";
}

// Indian-system number-to-words (whole rupees).
function numberToWordsIndian(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "Rupees Zero only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (x) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const threeDigits = (x) => (x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + twoDigits(x % 100) : "") : twoDigits(x));
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));
  return "Rupees " + parts.join(" ") + " only";
}

// Internal Rate of Return for an arbitrary cash-flow vector (Newton-Raphson).
function irr(cashflows, guess = 0.02) {
  const MAX_ITER = 200;
  const EPS = 1e-9;
  let r = guess;
  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + r, t);
      npv += cashflows[t] / denom;
      if (t > 0) dnpv -= (t * cashflows[t]) / (denom * (1 + r));
    }
    if (!isFinite(dnpv) || dnpv === 0) { r += 1e-6; continue; }
    const rNext = r - npv / dnpv;
    if (Math.abs(rNext - r) < EPS) return rNext;
    r = rNext;
  }
  return r;
}

// Indian-grouped digits for the amount input (no decimals).
function groupIndian(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-IN");
}

/* =================================================================
   Read inputs
   ================================================================= */
// Builds the canonical input object from accessor functions:
//   s(id) -> string value, n(id) -> numeric value.
// This lets the same logic serve the on-screen form and an imported CSV row.
function buildInput(s, n) {
  const rateMode = s("rateMode") || "Floating";
  const benchmarkRate = n("benchmarkRate") / 100;
  const spread = n("spread") / 100;
  const flatRate = n("flatRate") / 100;
  const floatRate = benchmarkRate + spread;
  const hybridFixedRate = n("hybridFixedRate") / 100;
  const hybridFixedYears = n("hybridFixedYears");
  let appliedRate;
  if (rateMode === "Floating") appliedRate = floatRate;
  else if (rateMode === "Hybrid") appliedRate = hybridFixedRate;
  else appliedRate = flatRate;

  const re = {
    processing: n("re_processing"),
    insurance: n("re_insurance"),
    valuation: n("re_valuation"),
    other: n("re_other"),
  };
  const tp = {
    processing: n("tp_processing"),
    insurance: n("tp_insurance"),
    valuation: n("tp_valuation"),
    other: n("tp_other"),
  };
  const chargeType = {
    processing: s("type_processing") || "One-time",
    insurance: s("type_insurance") || "One-time",
    valuation: s("type_valuation") || "One-time",
    other: s("type_other") || "One-time",
  };
  const chargeTypeB = {
    processing: s("type_b_processing") || "One-time",
    insurance: s("type_b_insurance") || "One-time",
    valuation: s("type_b_valuation") || "One-time",
    other: s("type_b_other") || "One-time",
  };

  return {
    proposalNo: s("proposalNo"),
    loanType: s("loanType"),
    amount: n("amount"),
    disbursalDate: s("disbursalDate"),
    disbursalSchedule: s("disbursalSchedule"),
    disbursalClause: s("disbursalClause"),
    tenureMonths: n("tenureMonths"),
    moratoriumMonths: n("moratoriumMonths"),
    payInterestMonthly: s("payInterestMonthly") || "No",
    // Derived (no longer entered): equated loans repay principal via the EPIs, so this is
    // always "Not applicable"; capitalised-interest instalments come from the MoP; and the
    // instalment method here is always monthly reducing balance.
    principalInstalments: "Not applicable (equated loan)",
    capitalisedInstalments: "Nil",
    frequency: s("frequency"),
    // Rounding step (in ₹) applied to each EPI/EMI: 0 = keep paise, 1/10/100 = round.
    roundEmi: n("roundEmi"),
    instalmentType: "Monthly Reducing Balance",
    rateMode,
    benchmark: s("benchmark"),
    benchmarkRate,
    spread,
    flatRate,
    floatRate,
    hybridFixedRate,
    hybridFixedYears,
    appliedRate,
    resetMonths: n("resetMonths"),
    re,
    tp,
    chargeType,
    chargeTypeB,
    contingent: {
      penal: s("c_penal"),
      otherPenal: s("c_otherpenal"),
      foreclosure: s("c_foreclosure"),
      switching: s("c_switching"),
      other: s("c_other"),
    },
    q: {
      cooling: s("q_cooling"),
      recovery: s("q_recovery"),
      grm: s("q_grm"),
      groName: s("q_groName"),
      groPhone: s("q_groPhone"),
      groEmail: s("q_groEmail"),
      transfer: s("q_transfer"),
      origRe: s("q_origRe"),
      origProp: s("q_origProp"),
      partnerRe: s("q_partnerRe"),
      partnerProp: s("q_partnerProp"),
      blended: s("q_blended"),
      lsp: s("q_lsp"),
    },
  };
}

function readInput() {
  return buildInput(str, num);
}

// Build the canonical input object from a CSV row (header -> value map).
function rowInput(row) {
  const s = (id) => (row[id] === undefined || row[id] === null ? "" : String(row[id]).trim());
  const n = (id) => parseFloat(s(id).replace(/,/g, "")) || 0;
  return buildInput(s, n);
}

/* =================================================================
   Calculate (mirrors Sheet1 / APR Computation / Annexure)
   ================================================================= */
function calculate(inp) {
  const P = inp.amount;
  const r = inp.appliedRate;
  const ppy = { "Monthly": 12, "Quarterly": 4, "Half-Yearly": 2, "Annually": 1 }[inp.frequency] || 12;
  const n = Math.round((inp.tenureMonths / 12) * ppy);
  const rp = r / ppy; // periodic rate

  const reTotal = inp.re.processing + inp.re.insurance + inp.re.valuation + inp.re.other;
  const tpTotal = inp.tp.processing + inp.tp.insurance + inp.tp.valuation + inp.tp.other;
  const totalCharges = reTotal + tpTotal;
  const netDisbursed = P - totalCharges;

  const isHybrid = inp.rateMode === "Hybrid";
  const rp2 = isHybrid ? inp.floatRate / ppy : rp;

  // Moratorium: initial periods with no instalment; interest accrues & capitalises.
  const totalN = n;
  const morPeriods = Math.max(0, Math.round((inp.moratoriumMonths || 0) * ppy / 12));
  const repayN = Math.max(1, totalN - morPeriods); // periods in which EPIs are actually paid

  // For hybrid: fixed phase length, reduced by any periods already consumed by the moratorium.
  const kFull = isHybrid ? Math.round(inp.hybridFixedYears * ppy) : 0;
  const k = isHybrid ? Math.max(0, Math.min(kFull - morPeriods, repayN)) : 0;

  const mpp = 12 / ppy; // months per instalment period
  // Everything is derived from the Date of Disbursement. The first instalment falls on the
  // END of the disbursement month itself; its interest covers only the days from the
  // disbursement date to that month-end. Any MoP shifts the first EPI further out.
  const commenceExplicit = false;
  const commenceMonths = inp.moratoriumMonths || 0;

  // First-instalment base date = disbursement month (month-end), shifted by any MoP.
  let baseDate = null;
  if (inp.disbursalDate) {
    const d = new Date(inp.disbursalDate);
    if (!isNaN(d)) { d.setMonth(d.getMonth() + commenceMonths); baseDate = d; }
  }

  // Month-end due date (a Date) for schedule row index p (0-based). Rows 0..morPeriods-1
  // are moratorium rows; row morPeriods is the first EPI (offset 0 from baseDate).
  const dueDateOf = (p) => eomDate(baseDate, Math.round((p - morPeriods) * mpp));
  const MS_PER_DAY = 86400000;
  const daysBetween = (a, b) => (a && b ? Math.round((b - a) / MS_PER_DAY) : 0);
  // Days from disbursement to the first schedule due date (end of the disbursement month).
  let commenceDays = 0;
  if (inp.disbursalDate && baseDate) {
    const dd = new Date(inp.disbursalDate);
    if (!isNaN(dd)) commenceDays = Math.max(0, daysBetween(dd, dueDateOf(0)));
  }
  // Interest accrues from the Date of Disbursal up to the first due date, so a mid-month
  // disbursal yields a correctly shortened first period.
  let accrualStart = null;
  if (inp.disbursalDate) {
    const d = new Date(inp.disbursalDate);
    if (!isNaN(d)) accrualStart = d;
  }
  if (!accrualStart) accrualStart = baseDate;

  // Accrual start for row p: normally the previous month-end. The very first row instead
  // accrues from the Date of Disbursal, so a mid-month disbursal yields a correctly
  // shortened first period. If that date is on/after the first due date, fall back to a
  // full first month.
  const prevDateOf = (p) => {
    if (p === 0 && accrualStart && daysBetween(accrualStart, dueDateOf(0)) > 0) return accrualStart;
    return dueDateOf(p - 1);
  };
  // Actual/365 day-count: interest for period p accrues over the ACTUAL number of days
  // in that period (so 31-, 30- and 28/29-day months differ, and the first instalment
  // reflects the Instalment Start Date). Falls back to the nominal periodic fraction
  // when no dates are available.
  const dayCount = !!baseDate;
  const periodFactor = (p) => (dayCount ? daysBetween(prevDateOf(p), dueDateOf(p)) / 365 : 1 / ppy);

  // Build amortization schedule (handles moratorium + single-rate and hybrid two-phase loans).
  const schedule = [];
  let bal = P;
  let totalInterest = 0;
  const cashflows = [-netDisbursed];

  // Phase 0 — moratorium: interest is either serviced monthly or capitalised.
  const serviceInterest = inp.payInterestMonthly === "Yes";
  for (let i = 1; i <= morPeriods; i++) {
    const interest = bal * r * periodFactor(i - 1);
    totalInterest += interest;
    if (serviceInterest) {
      // Interest paid monthly; principal (balance) is unchanged.
      schedule.push({ no: i, outstanding: bal, principal: 0, interest, instalment: interest, moratorium: true, interestPaid: true });
      cashflows.push(interest);
    } else {
      // Interest capitalised into the outstanding balance.
      schedule.push({ no: i, outstanding: bal, principal: -interest, interest, instalment: 0, moratorium: true, interestPaid: false });
      bal += interest;
      cashflows.push(0);
    }
  }

  const balAfterMor = bal; // principal to be amortized once repayment begins
  // Optional rounding of the equated instalment to the nearest ₹1/₹10/₹100. Any
  // residual created by rounding is cleared in the final instalment (see below).
  const roundStep = inp.roundEmi > 0 ? inp.roundEmi : 0;
  const roundEMI = (v) => (roundStep > 0 ? Math.round(v / roundStep) * roundStep : v);
  let emiPhase1 = roundEMI(-Fin.pmt(rp, repayN, bal));
  let emiPhase2 = emiPhase1;
  let emi = emiPhase1;

  for (let j = 1; j <= repayN; j++) {
    const p = morPeriods + j - 1;
    let pay = emiPhase1, annual = r;
    if (isHybrid && j > k) {
      if (j === k + 1) emiPhase2 = roundEMI(-Fin.pmt(rp2, repayN - k, bal)); // re-amortize remaining balance
      pay = emiPhase2; annual = inp.floatRate;
    }
    let interest = bal * annual * periodFactor(p);
    let principal = pay - interest;
    // The fixed EPI is equated at the nominal rate; actual-day interest leaves a small
    // residual, so the final instalment is adjusted to clear the outstanding exactly.
    if (j === repayN) { principal = bal; pay = principal + interest; }
    totalInterest += interest;
    schedule.push({ no: p + 1, outstanding: bal, principal, interest, instalment: pay });
    cashflows.push(pay);
    bal -= principal;
  }

  emi = emiPhase1;

  // APR: closed-form only for a plain single-rate loan with no day-count or moratorium;
  // IRR over the actual (irregular) cashflows otherwise.
  let apr;
  if (isHybrid || morPeriods > 0 || dayCount) {
    apr = irr(cashflows) * ppy;
  } else {
    apr = totalCharges >= 0 ? Fin.rate(repayN, -emi, netDisbursed, 0) * ppy : "";
  }

  // Impact of a 25 bps change (illustrative) — based on the post-moratorium balance.
  const baseRate = isHybrid ? inp.floatRate : r;
  const emi25 = trunc(-Fin.pmt((baseRate + 0.0025) / ppy, repayN, balAfterMor));
  const tenure25 = trunc(Fin.nper((baseRate + 0.0025) / ppy, -(-Fin.pmt(baseRate / ppy, repayN, balAfterMor)), balAfterMor));

  const totalPayable = P + totalInterest;

  // Stamp a month-end due date string on every schedule row.
  schedule.forEach((row, idx) => {
    row.dueDate = endOfMonthFrom(baseDate, Math.round((idx - morPeriods) * mpp));
  });
  const commencementDate = baseDate ? endOfMonthFrom(baseDate, 0) : addMonths(inp.disbursalDate, commenceMonths);

  return {
    P, r, n: repayN, totalN, morPeriods, moratoriumMonths: inp.moratoriumMonths || 0, interestServiced: serviceInterest, balAfterMor,
    emi, emiPhase1, emiPhase2, k, rp2, isHybrid,
    reTotal, tpTotal, totalCharges, apr,
    emi25, tenure25, totalInterest, netDisbursed, totalPayable,
    schedule, commencementDate, daysToCommence: commenceDays, commenceExplicit,
    amountWords: numberToWordsIndian(P),
  };
}

/* =================================================================
   Render the 5 RBI sections
   ================================================================= */
function buildKfsHtml(inp, res) {
  // Apply the chosen rounding to every money amount rendered below (KFS + all Annexures).
  KFS_ROUND_STEP = inp.roundEmi > 0 ? inp.roundEmi : 0;
  const disbDate = fmtDate(inp.disbursalDate);
  const hasFloat = inp.rateMode === "Floating" || inp.rateMode === "Hybrid";
  const tm = inp.tenureMonths || 0;
  const tenureTxt = `${tm} Month${tm == 1 ? "" : "s"}${tm % 12 === 0 && tm >= 12 ? ` (${tm / 12} Yr${tm / 12 == 1 ? "" : "s"})` : ""}`;

  const TOTAL = 4;
  const foot = (label, n) =>
    `<div class="page-foot"><span>${label}</span><span>Page ${n} of ${TOTAL}</span></div>`;

  const part1 = `
  <article class="kfs-page" id="part1">
    <div class="kfs-annex">Annexure-A</div>
    <div class="kfs-title">
      <div class="kfs-main">KEY FACTS STATEMENT (KFS)</div>
      <div class="kfs-sub">Part-1 (Interest Rate and Fees/Charges)</div>
    </div>
    <table class="kfs-table">
      <tr id="p1-s1"><td class="sn main">1</td><td colspan="3" class="nestcell">
        <table class="kfs-table nested">
          <tr>
            <td class="lbl" style="width:28%">Loan proposal / Account No.</td>
            <td class="val" style="width:24%">${inp.proposalNo || "-"}</td>
            <td class="lbl" style="width:20%">Type of Loan</td>
            <td class="val">${inp.loanType || "-"}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td class="sn main">2</td><td class="lbl">Sanctioned Loan amount (in Rupees)</td><td class="val" colspan="2">₹ ${fmtMoney(res.P)}<br><span class="muted">(${res.amountWords})</span></td></tr>
      <tr><td class="sn main">3</td><td class="lbl">Disbursal schedule<br><span class="muted">(i) Disbursement in stages or 100% upfront. (ii) If it is stage wise, mention the clause of loan agreement having relevant details.</span></td><td class="val" colspan="2">${inp.disbursalSchedule}${inp.disbursalClause ? " &mdash; " + inp.disbursalClause : ""}</td></tr>
      <tr id="p1-s4"><td class="sn main">4</td><td class="lbl">Loan term (year/months/days)</td><td class="val" colspan="2">${tenureTxt}${res.moratoriumMonths ? ` <span class="muted">(includes a MoP of ${res.moratoriumMonths} month${res.moratoriumMonths == 1 ? "" : "s"})</span>` : ""}</td></tr>
      <tr><td class="sn main">5</td><td class="lbl" colspan="3">Instalment details</td></tr>
      <tr><td colspan="4" class="nestcell">
        <table class="kfs-table nested">
          <tr class="subhead">
            <td>Type of instalments</td>
            <td>Number of (Equated Periodic Instalments) EPIs</td>
            <td>EPI (₹)</td>
            <td>Commencement of repayment, post sanction</td>
          </tr>
          <tr>
            <td>${inp.instalmentType}</td>
            <td>${res.n}</td>
            <td>${res.isHybrid
              ? `Fixed phase: ₹ ${fmtMoney(res.emiPhase1)}<br>Floating phase: ₹ ${fmtMoney(res.emiPhase2)}`
              : `₹ ${fmtMoney(res.emi)}`}</td>
            <td>${res.commencementDate}<br><span class="muted">(after ${res.daysToCommence} days${(!res.commenceExplicit && res.moratoriumMonths) ? ` + ${res.moratoriumMonths}-month MoP` : ""})</span></td>
          </tr>
        </table>
      </td></tr>
      <tr id="p1-s6"><td class="sn main">6</td><td class="lbl">Interest rate (%) and type (fixed/floating/hybrid)</td><td class="val" colspan="2">${res.isHybrid
        ? `<b>Hybrid</b> &mdash; ${fmtPct(inp.hybridFixedRate)} fixed for ${inp.hybridFixedYears} yr${inp.hybridFixedYears == 1 ? "" : "s"}, then ${fmtPct(inp.floatRate)} floating`
        : `${fmtPct(res.r)} &amp; ${inp.rateMode}`}</td></tr>
      <tr><td class="sn main">7</td><td class="lbl" colspan="3">Additional Information in case of Floating rate of interest${res.isHybrid ? " (applies to the floating phase of this hybrid loan)" : ""}</td></tr>
      <tr><td colspan="4" class="nestcell">
        <table class="kfs-table nested">
          <tr class="subhead">
            <td rowspan="2">Reference Benchmark</td>
            <td rowspan="2">Benchmark Rate (%) (B)</td>
            <td rowspan="2">Spread (%) (S)</td>
            <td rowspan="2">Final Rate (%) R = (B) + (S)</td>
            <td colspan="2">Reset Periodicity<sup>2</sup> (Months)</td>
            <td colspan="2">Impact of change in the reference benchmark<sup>3</sup><br><span class="muted">(for 25 bps change in 'R', change in)</span></td>
          </tr>
          <tr class="subhead">
            <td>B</td><td>S</td>
            <td>EPI (₹)</td><td>No. of EPIs</td>
          </tr>
          <tr>
            <td>${hasFloat ? inp.benchmark : "-"}</td>
            <td>${hasFloat ? fmtPct(inp.benchmarkRate) : "-"}</td>
            <td>${hasFloat ? fmtPct(inp.spread) : "-"}</td>
            <td>${hasFloat ? fmtPct(inp.floatRate) : "-"}</td>
            <td>${hasFloat ? inp.resetMonths : "-"}</td>
            <td>${hasFloat ? "Fixed" : "-"}</td>
            <td>${hasFloat ? "₹ " + fmtMoney(res.emi25) : "-"}</td>
            <td>${hasFloat ? res.tenure25 : "-"}</td>
          </tr>
        </table>
      </td></tr>
      <tr id="p1-s8"><td class="sn main">8</td><td class="lbl" colspan="3">Fee / Charges<sup>4</sup></td></tr>
      <tr><td colspan="4" class="nestcell">
        <table class="kfs-table nested">
          <tr class="subhead">
            <td rowspan="2" class="sn"></td><td rowspan="2">Charge</td>
            <td colspan="2">Payable to the RE (A)</td>
            <td colspan="2">Payable to a third party through RE (B)</td>
          </tr>
          <tr class="subhead">
            <td>One-time / Recurring</td><td>Amount (₹) or % (as applicable)<sup>5</sup></td>
            <td>One-time / Recurring</td><td>Amount (₹) or % (as applicable)<sup>5</sup></td>
          </tr>
          <tr><td class="sn sub">(i)</td><td>Processing fees</td><td>${inp.chargeType.processing}</td><td>₹ ${fmtMoney(inp.re.processing)}</td><td>${inp.chargeTypeB.processing}</td><td>₹ ${fmtMoney(inp.tp.processing)}</td></tr>
          <tr><td class="sn sub">(ii)</td><td>Insurance charges</td><td>${inp.chargeType.insurance}</td><td>₹ ${fmtMoney(inp.re.insurance)}</td><td>${inp.chargeTypeB.insurance}</td><td>₹ ${fmtMoney(inp.tp.insurance)}</td></tr>
          <tr><td class="sn sub">(iii)</td><td>Valuation fees</td><td>${inp.chargeType.valuation}</td><td>₹ ${fmtMoney(inp.re.valuation)}</td><td>${inp.chargeTypeB.valuation}</td><td>₹ ${fmtMoney(inp.tp.valuation)}</td></tr>
          <tr><td class="sn sub">(iv)</td><td>Any other (please specify)</td><td>${inp.chargeType.other}</td><td>₹ ${fmtMoney(inp.re.other)}</td><td>${inp.chargeTypeB.other}</td><td>₹ ${fmtMoney(inp.tp.other)}</td></tr>
          <tr class="totrow"><td class="sn"></td><td>Total Charges</td><td></td><td>₹ ${fmtMoney(res.reTotal)}</td><td></td><td>₹ ${fmtMoney(res.tpTotal)}</td></tr>
        </table>
      </td></tr>
      <tr><td class="sn main">9</td><td class="lbl">Annual Percentage Rate (APR) (%)<sup>6</sup></td><td class="val" colspan="2"><b>${fmtPct(res.apr)}</b></td></tr>
      <tr id="p1-s10"><td class="sn main">10</td><td class="lbl" colspan="3">Details of Contingent Charges (in ₹ or %, as applicable)</td></tr>
      <tr><td class="sn sub">(i)</td><td class="lbl sub-lbl" colspan="2">Penal charges, if any, in case of delayed payment</td><td>${inp.contingent.penal || "-"}</td></tr>
      <tr><td class="sn sub">(ii)</td><td class="lbl sub-lbl" colspan="2">Other penal charges, if any</td><td>${inp.contingent.otherPenal || "-"}</td></tr>
      <tr><td class="sn sub">(iii)</td><td class="lbl sub-lbl" colspan="2">Foreclosure charges, if applicable</td><td>${inp.contingent.foreclosure || "-"}</td></tr>
      <tr><td class="sn sub">(iv)</td><td class="lbl sub-lbl" colspan="2">Charges for switching of loans (floating &harr; fixed)</td><td>${inp.contingent.switching || "-"}</td></tr>
      <tr><td class="sn sub">(v)</td><td class="lbl sub-lbl" colspan="2">Any other charges (please specify)</td><td>${inp.contingent.other || "-"}</td></tr>
    </table>
    <div class="kfs-notes">
      <p><sup>2</sup> Fixed reset, other than on account of changes in credit profile.</p>
      <p><sup>3</sup> Please refer to RBI circular 'Reset of Floating Interest Rate on Equated Monthly Instalments (EMI) based Personal Loans' dated August 18, 2023.</p>
      <p><sup>4</sup> REs may disclose the amount net of any taxes such as GST.</p>
      <p><sup>5</sup> Mention frequency, where recurring.</p>
      <p><sup>6</sup> Please refer to the illustration in Annexure-A(1).</p>
    </div>
    ${foot("Annexure-A &middot; Key Facts Statement (Part-1)", 1)}
  </article>`;

  const part2 = `
  <article class="kfs-page" id="part2">
    <div class="kfs-annex">Annexure-A</div>
    <div class="kfs-title"><div class="kfs-main">KEY FACTS STATEMENT (KFS)</div><div class="kfs-sub">Part-2 (Other Qualitative Information)</div></div>
    <table class="kfs-table">
      <tr><td class="sn main">1</td><td class="lbl">Clause of Loan agreement relating to engagement of recovery agents</td><td class="val">${inp.q.recovery || "-"}</td></tr>
      <tr><td class="sn main">2</td><td class="lbl">Clause of Loan agreement with details grievance redressal mechanism</td><td class="val">${inp.q.grm || "-"}</td></tr>
      <tr><td class="sn main">3</td><td class="lbl">Phone number and email id of the nodal grievance redressal officer<sup>7</sup></td><td class="val">${[inp.q.groName, inp.q.groPhone, inp.q.groEmail].filter(Boolean).join("<br>") || "-"}</td></tr>
      <tr><td class="sn main">4</td><td class="lbl">Whether the loan is, or in future maybe, subject to transfer to other Bank or securitisation (Yes/ No)</td><td class="val">${inp.q.transfer || "-"}</td></tr>
      <tr><td class="sn main">5</td><td class="lbl" colspan="2">In case of lending under collaborative lending arrangements (e.g. co lending/ outsourcing), following additional details may be furnished</td></tr>
      <tr><td colspan="3" class="nestcell">
        <table class="kfs-table nested">
          <tr class="subhead">
            <td>Name of the originating RE, along with its funding proportion</td>
            <td>Name of the partner RE along with its proportion of funding</td>
            <td>Blended rate of interest</td>
          </tr>
          <tr>
            <td>${inp.q.origRe || "-"}${inp.q.origProp ? " (" + inp.q.origProp + ")" : ""}</td>
            <td>${inp.q.partnerRe || "-"}${inp.q.partnerProp ? " (" + inp.q.partnerProp + ")" : ""}</td>
            <td>${inp.q.blended || "-"}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td class="sn main">6</td><td class="lbl" colspan="2">In case of digital loans, following specific disclosures may be furnished:</td></tr>
      <tr><td class="sn sub">(i)</td><td class="lbl sub-lbl">Cooling off / look-up period, in terms of RE's board approved policy, during which borrower shall not be charged any penalty on prepayment of loan</td><td class="val">${inp.q.cooling || "-"}</td></tr>
      <tr><td class="sn sub">(ii)</td><td class="lbl sub-lbl">Details of LSP acting as recovery agent and authorized to approach the borrower</td><td class="val">${inp.q.lsp || inp.q.recovery || "-"}</td></tr>
    </table>
    <div class="kfs-notes">
      <p><sup>7</sup> RE may furnish a generic email id, provided a response is made within 1 working day.</p>
    </div>
    ${foot("Annexure-A &middot; Key Facts Statement (Part-2)", 2)}
  </article>`;

  const apr = `
  <article class="kfs-page" id="aprcomp">
    <div class="kfs-annex">Annexure-A(1)</div>
    <div class="kfs-title"><div class="kfs-main">Illustration for computation of APR for MSME Loans</div></div>
    <table class="kfs-table">
      <tr class="subhead"><td class="sn">Sl. No</td><td>Parameter</td><td>Details</td></tr>
      <tr><td class="sn main">1</td><td>Sanctioned Loan amount (in Rupees) (Sl no. 2 of the KFS template &ndash; Part 1)</td><td>₹ ${fmtMoney(res.P)}</td></tr>
      <tr><td class="sn main">2</td><td>Loan Term (in years / months / days) (Sl No. 4 of the KFS template &ndash; Part 1)</td><td>${tenureTxt}</td></tr>
      <tr><td class="sn sub">a)</td><td class="sub-lbl">No. of instalments for payment of principal, in case of non-equated periodic loans</td><td>${inp.principalInstalments || "-"}</td></tr>
      <tr><td class="sn sub">b)</td><td class="sub-lbl">Type of EPI; Amount of each EPI (in Rupees) and nos. of EPIs (e.g. no. of EMIs in case of monthly instalments) (Sl No. 5 of the KFS template &ndash; Part 1)</td><td>${inp.frequency}; ₹ ${fmtMoney(res.emi)}; ${res.n}</td></tr>
      <tr><td class="sn sub">c)</td><td class="sub-lbl">No. of instalments for payment of capitalised interest, if any</td><td>${res.morPeriods ? (res.interestServiced ? `Nil (interest serviced monthly during the ${res.moratoriumMonths}-month MoP)` : `${res.morPeriods} (interest capitalised during ${res.moratoriumMonths}-month MoP)`) : (inp.capitalisedInstalments || "-")}</td></tr>
      <tr><td class="sn sub">d)</td><td class="sub-lbl">Commencement of repayments, post sanction (Sl No. 5 of the KFS template &ndash; Part 1)</td><td>${res.daysToCommence} days${(!res.commenceExplicit && res.moratoriumMonths) ? ` + ${res.moratoriumMonths}-month MoP` : ""} (${res.commencementDate})</td></tr>
      <tr><td class="sn main">3</td><td>Interest rate type (fixed or floating or hybrid) (Sl No. 6 of the KFS template &ndash; Part 1)</td><td>${inp.rateMode}</td></tr>
      <tr><td class="sn main">4</td><td>Rate of Interest (Sl No. 6 of the KFS template &ndash; Part 1)</td><td>${res.isHybrid ? `${fmtPct(inp.hybridFixedRate)} (fixed ${inp.hybridFixedYears} yr${inp.hybridFixedYears == 1 ? "" : "s"}), then ${fmtPct(inp.floatRate)} (floating)` : fmtPct(res.r)}</td></tr>
      <tr><td class="sn main">5</td><td>Total Interest Amount to be charged during the entire tenor of the loan as per the rate prevailing on sanction date (in Rupees)</td><td>₹ ${fmtMoney(res.totalInterest)}</td></tr>
      <tr><td class="sn main">6</td><td>Fee / Charges payable<sup>8</sup> (in Rupees)</td><td>₹ ${fmtMoney(res.totalCharges)}</td></tr>
      <tr><td class="sn sub">A)</td><td class="sub-lbl">Payable to the RE (Sl No. 8A of the KFS template &ndash; Part 1)</td><td>₹ ${fmtMoney(res.reTotal)}</td></tr>
      <tr><td class="sn sub">B)</td><td class="sub-lbl">Payable to third-party routed through RE (Sl No. 8B of the KFS template &ndash; Part 1)</td><td>₹ ${fmtMoney(res.tpTotal)}</td></tr>
      <tr><td class="sn main">7</td><td>Net disbursed amount (1 - 6) (in Rupees)</td><td>₹ ${fmtMoney(res.netDisbursed)}</td></tr>
      <tr><td class="sn main">8</td><td>Total amount to be paid by the borrower (sum of 1 and 5) (in Rupees)<sup>9</sup></td><td>₹ ${fmtMoney(res.totalPayable)}</td></tr>
      <tr><td class="sn main">9</td><td>Annual Percentage Rate - Effective annualized interest rate (in percentage)<sup>10</sup> (Sl No. 9 of the KFS template &ndash; Part 1)</td><td><b>${fmtPct(res.apr)}</b></td></tr>
      <tr><td class="sn main">10</td><td>Schedule of disbursement as per terms and conditions</td><td>${inp.disbursalSchedule}</td></tr>
      <tr><td class="sn main">11</td><td>Due date of payment of instalment and interest</td><td>${res.commencementDate}</td></tr>
    </table>
    <div class="kfs-notes">
      <p><sup>8</sup> Where such charges cannot be determined prior to sanction, REs may indicate an upper ceiling.</p>
      <p><sup>9</sup> Any difference vis-à-vis the total of instalments in the detailed repayment schedule is on account of rounding off of the instalment amount.</p>
      <p><sup>10</sup> Computed on net disbursed amount using IRR approach and reducing balance method.</p>
    </div>
    ${foot("Annexure-A(1) &middot; Illustration for computation of APR for MSME Loans", 3)}
  </article>`;

  const rows = res.schedule.map(s => `
      <tr${s.moratorium ? ' class="mor-row"' : ""}>
        <td>${s.no}${s.moratorium ? ' <span class="muted">(MoP)</span>' : ""}</td>
        <td>₹ ${fmtMoney(s.outstanding)}</td>
        <td>${s.moratorium ? (s.interestPaid ? '<span class="muted">Interest only</span>' : '<span class="muted">Interest capitalised</span>') : "₹ " + fmtMoney(s.principal)}</td>
        <td>₹ ${fmtMoney(s.interest)}</td>
        <td>₹ ${fmtMoney(s.instalment)}</td>
      </tr>`).join("");

  const annexure = `
  <article class="kfs-page" id="annexure">
    <div class="kfs-annex">Annexure-A(2)</div>
    <div class="kfs-title"><div class="kfs-main">ILLUSTRATIVE REPAYMENT SCHEDULE UNDER EQUATED PERIODIC INSTALMENT</div><div class="kfs-sub">For the hypothetical loan illustrated in Annexure-A(1)</div></div>
    <table class="kfs-table schedule">
      <thead>
        <tr class="subhead">
          <th>Instalment No</th><th>Outstanding Principal (in Rupees)</th>
          <th>Principal (in Rupees)</th><th>Interest (in Rupees)</th><th>Instalment (in Rupees)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${foot("Annexure-A(2) &middot; Illustrative Repayment Schedule", 4)}
  </article>`;

  return part1 + part2 + apr + annexure;
}

function render(inp, res) {
  document.getElementById("kfsOutput").innerHTML = buildKfsHtml(inp, res);
  addPageControls();
}

// Add an Edit/Save toggle to every KFS page so the user can correct any
// discrepancy inline before printing/exporting. Buttons are .no-print so they
// never appear in the printed or PDF output.
function addPageControls() {
  document.querySelectorAll("#kfsOutput .kfs-page").forEach(page => {
    if (page.querySelector(":scope > .page-edit-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-edit-btn no-print";
    btn.setAttribute("contenteditable", "false");
    btn.textContent = "\u270E Edit";
    btn.title = "Edit this page to correct any discrepancy before printing";
    btn.addEventListener("click", () => {
      const editing = page.classList.toggle("editing");
      page.setAttribute("contenteditable", editing ? "true" : "false");
      btn.textContent = editing ? "\u2714 Save" : "\u270E Edit";
      btn.classList.toggle("saving", editing);
      if (editing) {
        page.focus();
      } else {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }
    });
    page.appendChild(btn);
  });
}

/* =================================================================
   Wire up
   ================================================================= */
function refresh() {
  const inp = readInput();
  const res = calculate(inp);
  render(inp, res);
}

function toggleRateMode() {
  const mode = str("rateMode");
  const floating = mode === "Floating";
  const hybrid = mode === "Hybrid";
  // The floating-info block is relevant for both Floating and the floating phase of Hybrid.
  document.getElementById("floatingBlock").classList.toggle("hidden", !(floating || hybrid));
  // The single fixed rate input only applies to a pure Fixed loan.
  document.getElementById("flatRateLabel").classList.toggle("hidden", floating || hybrid);
  const hybridBlock = document.getElementById("hybridBlock");
  if (hybridBlock) hybridBlock.classList.toggle("hidden", !hybrid);
}

// Show the companion free-text box whenever a combo dropdown is set to "Other".
function toggleCombos() {
  document.querySelectorAll("select.combo").forEach(sel => {
    const other = document.getElementById(sel.id + "_other");
    if (other) other.classList.toggle("hidden", sel.value !== "__other__");
  });
}

/* =================================================================
   Product profiles — when a Type of Loan is selected, the form is
   auto-filled with indicative defaults for that product per RBI /
   typical bank norms. Only product-level fields are set; instance
   identifiers (account no., dates, GRO, clauses) are left untouched.
   ================================================================= */
const _BM_REPO = "RBI Policy Repo Rate";
const _BM_EBLR = "External Benchmark Lending Rate (EBLR)";

const LOAN_TYPE_PROFILES = {
  // ECLGS 5.0: WC term loan, EBLR+0.75% capped 9%, 5-yr tenure incl. 1-yr moratorium, nil fees.
  "ECLGS 5.0 (Emergency Credit Line Guarantee Scheme)": {
    amount: "2,00,000", tenureMonths: "60", moratoriumMonths: "12", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_EBLR, benchmarkRate: "8.25", spread: "0.75", resetMonths: "3",
    re_processing: "0", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (no foreclosure / prepayment charges \u2014 ECLGS)", c_switching: "Nil",
    c_other: "Nil", q_cooling: "Not applicable", q_transfer: "No",
  },
  // MSME Term Loan: capex term loan, repo-linked, 7-yr tenure, short moratorium, ~1% processing.
  "MSME Term Loan": {
    amount: "10,00,000", tenureMonths: "84", moratoriumMonths: "6", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3", resetMonths: "3",
    re_processing: "10000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "5000", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)",
    c_switching: "0.50% of outstanding principal + applicable GST",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "Yes",
  },
  // MSME Working Capital: annual demand facility, repo-linked, renewable yearly.
  "MSME Working Capital Loan": {
    amount: "15,00,000", tenureMonths: "12", moratoriumMonths: "0", payInterestMonthly: "No",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3.25", resetMonths: "3",
    re_processing: "7500", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)", c_switching: "Nil",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "No",
  },
  // CC/OD: running account, annual renewal, interest on utilisation.
  "Cash Credit / Overdraft (CC/OD)": {
    amount: "20,00,000", tenureMonths: "12", moratoriumMonths: "0", payInterestMonthly: "No",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3.5", resetMonths: "3",
    re_processing: "5000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)", c_switching: "Nil",
    c_other: "As per Schedule of Charges", q_cooling: "Not applicable", q_transfer: "No",
  },
  // Machinery / Equipment: secured term loan, valuation fee, short moratorium.
  "Machinery / Equipment Loan": {
    amount: "15,00,000", tenureMonths: "72", moratoriumMonths: "6", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3", resetMonths: "3",
    re_processing: "15000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "5000", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)",
    c_switching: "0.50% of outstanding principal + applicable GST",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "Yes",
  },
  // LAP: property-secured, long tenure, valuation + insurance.
  "MSME Loan Against Property": {
    amount: "50,00,000", tenureMonths: "180", moratoriumMonths: "0", payInterestMonthly: "No",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "2.5", resetMonths: "3",
    re_processing: "25000", re_insurance: "0", re_valuation: "0", re_other: "5000",
    tp_processing: "0", tp_insurance: "8000", tp_valuation: "5000", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)",
    c_switching: "0.50% of outstanding principal + applicable GST",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "Yes",
  },
  // MUDRA: collateral-free (CGFMU), Shishu/Kishore/Tarun, nil processing for Shishu.
  "MUDRA Loan (Shishu / Kishore / Tarun)": {
    amount: "5,00,000", tenureMonths: "60", moratoriumMonths: "6", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "2.75", resetMonths: "3",
    re_processing: "0", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)", c_switching: "Nil",
    c_other: "Nil", q_cooling: "Not applicable", q_transfer: "No",
  },
  // Stand-Up India: SC/ST/women, composite loan, 7-yr tenure incl. up to 18-month moratorium.
  "Stand-Up India Loan": {
    amount: "25,00,000", tenureMonths: "84", moratoriumMonths: "18", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3", resetMonths: "3",
    re_processing: "10000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "5000", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)",
    c_switching: "0.50% of outstanding principal + applicable GST",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "No",
  },
  // CGTMSE-backed: collateral-free up to ₹5cr, guarantee-covered, no valuation.
  "CGTMSE-backed MSME Loan": {
    amount: "10,00,000", tenureMonths: "60", moratoriumMonths: "6", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "3", resetMonths: "3",
    re_processing: "10000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)", c_switching: "Nil",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST", q_cooling: "Not applicable", q_transfer: "No",
  },
  // Bill / Invoice Discounting: short-tenor, fixed discount rate, bullet repayment.
  "Bill / Invoice Discounting": {
    amount: "10,00,000", tenureMonths: "3", moratoriumMonths: "0", payInterestMonthly: "No",
    frequency: "Monthly", rateMode: "Fixed", flatRate: "10", resetMonths: "3",
    re_processing: "2500", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Not applicable", c_switching: "Nil", c_other: "Nil",
    q_cooling: "Not applicable", q_transfer: "Yes",
  },
  // LC / BG: non-fund based, commission-based, no EPI interest.
  "Letter of Credit / Bank Guarantee": {
    amount: "10,00,000", tenureMonths: "12", moratoriumMonths: "0", payInterestMonthly: "No",
    frequency: "Quarterly", rateMode: "Fixed", flatRate: "2", resetMonths: "3",
    re_processing: "5000", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "As per Loan Agreement", c_otherpenal: "Nil",
    c_foreclosure: "Not applicable", c_switching: "Nil", c_other: "As per Schedule of Charges",
    q_cooling: "Not applicable", q_transfer: "No",
  },
};

// Set a field's value, handling plain inputs and combo selects. For a combo
// whose value isn't an existing option, fall back to "Other (specify)" and put
// the text in the companion free-text box.
function setFieldValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "SELECT") {
    let matched = false;
    for (const opt of el.options) {
      if (opt.value === val || opt.text === val) { el.value = opt.value; matched = true; break; }
    }
    if (!matched) {
      const other = document.getElementById(id + "_other");
      const hasOther = Array.from(el.options).some(o => o.value === "__other__");
      if (other && hasOther) { el.value = "__other__"; other.value = val; }
      else { el.value = val; }
    }
  } else {
    el.value = val;
  }
}

// Auto-fill the form with the indicative defaults for the selected loan product.
function applyLoanTypeProfile(name) {
  const profile = LOAN_TYPE_PROFILES[name];
  if (!profile) return;
  Object.entries(profile).forEach(([id, val]) => setFieldValue(id, val));
}

/* =================================================================
   Persistence (auto-save) + reset to defaults
   ================================================================= */
const STORAGE_KEY = "kfsMakerInputs_v1";
const DEFAULTS = {};

function captureDefaults() {
  document.querySelectorAll(".form-panel input, .form-panel select").forEach(el => {
    if (el.id && el.type !== "file") DEFAULTS[el.id] = el.value;
  });
}

function saveInputs() {
  const data = {};
  document.querySelectorAll(".form-panel input, .form-panel select").forEach(el => {
    if (el.id && el.type !== "file") data[el.id] = el.value;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}

function restoreInputs() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) { data = null; }
  if (!data) return;
  Object.entries(data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && el.type !== "file") el.value = val;
  });
}

function resetToDefaults() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  Object.entries(DEFAULTS).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  document.querySelectorAll(".form-panel .invalid").forEach(el => el.classList.remove("invalid"));
  const box = document.getElementById("validateMsg");
  if (box) { box.className = "validate-box hidden"; box.innerHTML = ""; }
  const fab = document.getElementById("fabValidate");
  if (fab) fab.classList.remove("fab-error", "fab-ok");
  formatAmount();
  toggleRateMode();
  toggleCombos();
  refresh();
}

// Live Indian-grouped formatting for the sanctioned amount, and amount-in-words preview.
function formatAmount() {
  const el = document.getElementById("amount");
  if (!el) return;
  const grouped = groupIndian(el.value);
  if (grouped !== el.value) el.value = grouped;
  const words = document.getElementById("amountWords");
  if (words) {
    const n = num("amount");
    words.textContent = n > 0 ? numberToWordsIndian(n) : "";
  }
}

/* =================================================================
   Field help popup
   ================================================================= */
function hideHelp() {
  const o = document.getElementById("helpOverlay");
  if (o) o.classList.add("hidden");
}

function showHelp(name, desc, isHtml) {
  let overlay = document.getElementById("helpOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "helpOverlay";
    overlay.className = "help-overlay no-print hidden";
    overlay.innerHTML =
      `<div class="help-modal" role="dialog" aria-modal="true">` +
      `<button type="button" class="help-close" aria-label="Close">&times;</button>` +
      `<h3 class="help-modal-title"></h3>` +
      `<div class="help-modal-desc"></div>` +
      `</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) hideHelp(); });
    overlay.querySelector(".help-close").addEventListener("click", hideHelp);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideHelp(); });
  }
  overlay.querySelector(".help-modal-title").textContent = name;
  const descEl = overlay.querySelector(".help-modal-desc");
  if (isHtml) descEl.innerHTML = desc;
  else descEl.textContent = desc;
  overlay.classList.remove("hidden");
}

// Overall usage guide shown from the header "?" button.
function showGuide() {
  const html =
    `<ol class="guide-list">` +
    `<li><b>Built for MSME loans.</b> This generates the RBI <i>Key Facts Statement (Annexure-A)</i> &mdash; Part-1, Part-2, the APR illustration (<i>Annexure-A(1)</i>) and the repayment schedule (<i>Annexure-A(2)</i>).</li>` +
    `<li><b>Pick the <i>Type of Loan</i> first.</b> Selecting a product (ECLGS 5.0, MSME Term Loan, MUDRA, CC/OD, LAP, etc.) <b>auto-fills indicative defaults</b> &mdash; tenure, rate, moratorium, fees and charges &mdash; per RBI / typical bank norms. Adjust any value as needed.</li>` +
    `<li><b>Fill in the loan details.</b> Inputs are grouped into cards by KFS serial number (Sl. 1&ndash;10, then Part-2). Every field has a small <span class="guide-q">?</span> marker &mdash; click it to see what that field means.</li>` +
    `<li><b>Jump to a section.</b> Click any input card and the matching section of the KFS preview scrolls into view and briefly highlights.</li>` +
    `<li><b>Pick the rate type.</b> Choose <i>Floating</i>, <i>Fixed</i>, or <i>Hybrid</i> (fixed for an initial period, then floating). Relevant rate fields appear automatically.</li>` +
    `<li><b>Fees &amp; charge nature.</b> Enter the amount and the <i>One-time / Recurring</i> nature side-by-side for <i>Payable to RE (8A)</i> and <i>Third Party (8B)</i>.</li>` +
    `<li><b>Use dropdowns.</b> Many fields are dropdowns; choose <i>Other (specify)</i> to type a custom value.</li>` +
    `<li><b>Click <span class="guide-pill">&#10003; Validate</span></b> (floating button, bottom-right). Any missing or invalid fields are highlighted in red and listed at the top.</li>` +
    `<li><b>Download / Print PDF.</b> Enabled once validation passes &mdash; this prints the full KFS (Annexure-A Parts 1&amp;2, Annexure-A(1) and Annexure-A(2)), each on its own page.</li>` +
    `<li><b>Bulk loans (CSV).</b> In <i>Bulk Import</i>: click <span class="guide-pill">Download CSV template</span>, fill <b>one row per loan</b>, then <span class="guide-pill">Import CSV</span>. Every row is validated; valid ones generate a KFS each and invalid ones are listed and skipped.</li>` +
    `<li><b>Auto-save &amp; Reset.</b> Your inputs are saved in this browser automatically. <span class="guide-pill">Reset</span> clears them back to the defaults.</li>` +
    `</ol>` +
    `<p class="guide-note">Illustrative aid based on RBI Circular RBI/2024-25/18 dated April 15, 2024 (Key Facts Statement / Annexure-A for MSME loans). Always verify against the latest RBI notifications.</p>`;
  showHelp("How to use the MSME KFS Builder", html, true);
}

/* =================================================================
   Validation of mandatory fields
   ================================================================= */
// Returns the control that should be visually flagged (the "Other" box when relevant).
function fieldControl(id) {
  const el = document.getElementById(id);
  if (el && el.tagName === "SELECT" && el.value === "__other__") {
    return document.getElementById(id + "_other") || el;
  }
  return el;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s\d]{7,20}$/;

// Single source of truth for mandatory fields (used by the form and the CSV import).
function requiredRulesFor(mode) {
  const required = [
    ["proposalNo", "Loan Proposal / Account No."],
    ["loanType", "Type of Loan"],
    ["amount", "Sanctioned Amount", "positive"],
    ["disbursalDate", "Date of Disbursement"],
    ["disbursalSchedule", "Disbursement Schedule"],
    ["tenureMonths", "Tenure (Months)", "positive"],
    ["frequency", "Instalment Frequency"],
    ["rateMode", "Rate Type"],
    ["q_recovery", "Recovery agent clause"],
    ["q_grm", "Grievance redressal clause"],
    ["q_groName", "Name of Grievance Redressal Officer (GRO)"],
    ["q_groPhone", "Phone of Grievance Redressal Officer (GRO)", "phone"],
    ["q_groEmail", "Email of Grievance Redressal Officer (GRO)", "email"],
    ["q_transfer", "Subject to transfer / securitization (Y/N)"],
  ];
  if (mode === "Floating") {
    required.push(["benchmark", "Reference Benchmark"]);
    required.push(["benchmarkRate", "Benchmark Rate (%) (B)", "positive"]);
    required.push(["spread", "Spread (%) (S)"]);
  } else if (mode === "Hybrid") {
    required.push(["hybridFixedRate", "Initial Fixed Rate (%)", "positive"]);
    required.push(["hybridFixedYears", "Fixed-rate period (years)", "positive"]);
    required.push(["benchmark", "Reference Benchmark (floating phase)"]);
    required.push(["benchmarkRate", "Benchmark Rate (%) (B)", "positive"]);
    required.push(["spread", "Spread (%) (S)"]);
  } else {
    required.push(["flatRate", "Fixed Rate (%)", "positive"]);
  }
  return required;
}

// Validate a value accessor (s) against the rules for the given mode.
// Returns an array of human-readable problems (empty == valid).
function validateValues(s) {
  const mode = s("rateMode") || "Floating";
  const problems = [];
  requiredRulesFor(mode).forEach(([id, label, rule]) => {
    const val = (s(id) || "").trim();
    if (val === "") { problems.push(label + " — missing"); return; }
    const n = parseFloat(val.replace(/,/g, ""));
    if (rule === "positive" && !(n > 0)) problems.push(label + " — must be greater than 0");
    else if (rule === "email" && !EMAIL_RE.test(val)) problems.push(label + " — invalid email format");
    else if (rule === "phone" && !PHONE_RE.test(val)) problems.push(label + " — invalid phone number");
  });
  return problems;
}

// Cross-field "banking term" consistency checks (beyond per-field presence/format).
// Returns [{ msg, fields:[ids] }]. ISO yyyy-mm-dd date strings compare correctly as text.
function bankingTermProblems() {
  const out = [];

  const tenure = num("tenureMonths");
  const mor = num("moratoriumMonths");
  if (tenure > 0 && mor >= tenure)
    out.push({ msg: "MoP (Moratorium Period) must be shorter than the Tenure", fields: ["moratoriumMonths", "tenureMonths"] });

  if (str("rateMode") === "Hybrid" && tenure > 0 && num("hybridFixedYears") * 12 > tenure)
    out.push({ msg: "Hybrid fixed-rate period must not exceed the Tenure", fields: ["hybridFixedYears", "tenureMonths"] });

  return out;
}

// Readable label for a form control (the text of its wrapping <label>, minus the
// help marker and any nested controls).
function fieldLabel(el) {
  const lab = el.closest("label");
  if (!lab) return el.id;
  const clone = lab.cloneNode(true);
  clone.querySelectorAll(".help, select, input, textarea").forEach(n => n.remove());
  return clone.textContent.trim().replace(/\s+/g, " ") || el.id;
}

// Dependent-field checks: when one field's value makes another field mandatory and that
// dependent field is left blank. Returns [{ msg, fields:[ids] }] so the caller can
// highlight and scroll to the exact control that needs filling.
function dependentFieldProblems(skipIds) {
  const out = [];
  skipIds = skipIds || new Set();
  // 1. Any "Other (specify)" dropdown requires its companion free-text to be filled.
  document.querySelectorAll(".form-panel select.combo").forEach(sel => {
    if (skipIds.has(sel.id)) return; // already covered by the required-field check
    if (sel.value === "__other__") {
      const other = document.getElementById(sel.id + "_other");
      if (other && other.value.trim() === "") {
        out.push({ msg: `Please specify “${fieldLabel(sel)}” — you selected “Other”.`, fields: [sel.id] });
      }
    }
  });
  // 2. Stage-wise disbursement clause is required when disbursing in stages.
  if (/stage/i.test(str("disbursalSchedule"))) {
    const clause = document.getElementById("disbursalClause");
    if (clause && clause.value.trim() === "") {
      out.push({ msg: "Disbursement is “in stages” — please fill the Stage-wise clause.", fields: ["disbursalClause"] });
    }
  }
  return out;
}

function validateForm() {
  const required = requiredRulesFor(str("rateMode"));

  // clear previous flags
  document.querySelectorAll(".form-panel .invalid").forEach(el => el.classList.remove("invalid"));

  const emailRe = EMAIL_RE;
  const phoneRe = PHONE_RE;
  const missing = [];
  const invalidFormat = [];
  required.forEach(([id, label, rule]) => {
    const val = str(id);
    let bad = val === "";
    if (bad) {
      const ctl = fieldControl(id);
      if (ctl) ctl.classList.add("invalid");
      missing.push(label);
      return;
    }
    if (rule === "positive" && !(num(id) > 0)) {
      fieldControl(id)?.classList.add("invalid");
      missing.push(label);
    } else if (rule === "email" && !emailRe.test(val)) {
      fieldControl(id)?.classList.add("invalid");
      invalidFormat.push(label + " — invalid email format");
    } else if (rule === "phone" && !phoneRe.test(val)) {
      fieldControl(id)?.classList.add("invalid");
      invalidFormat.push(label + " — invalid phone number");
    }
  });
  const problems = missing.concat(invalidFormat);

  // Banking-term consistency (date ordering, moratorium vs tenure, etc.).
  bankingTermProblems().forEach(it => {
    it.fields.forEach(id => fieldControl(id)?.classList.add("invalid"));
    problems.push(it.msg);
  });

  // Dependent fields: a blank field that another field's value made mandatory
  // (e.g. an "Other" dropdown's specify box, or the stage-wise clause).
  const requiredIds = new Set(required.map(r => r[0]));
  dependentFieldProblems(requiredIds).forEach(it => {
    it.fields.forEach(id => fieldControl(id)?.classList.add("invalid"));
    problems.push(it.msg);
  });

  const box = document.getElementById("validateMsg");
  const fab = document.getElementById("fabValidate");
  fab.classList.remove("fab-error", "fab-ok");
  box.classList.remove("hidden", "error", "ok");

  if (problems.length) {
    box.classList.add("error");
    box.innerHTML =
      `<span class="vb-title">${problems.length} issue${problems.length > 1 ? "s" : ""} to fix:</span>` +
      `<ul>${problems.map(m => `<li>${m}</li>`).join("")}</ul>` +
      `<span>Please correct the highlighted fields before printing.</span>`;
    fab.classList.add("fab-error");
    setOutputButtons(false, "Fix all highlighted fields, then Validate to enable this");
    const first = document.querySelector(".form-panel .invalid");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    box.classList.add("ok");
    box.innerHTML = `<span class="vb-title">&#10003; All mandatory fields are filled.</span>The KFS below is ready to download / print.`;
    fab.classList.add("fab-ok");
    setOutputButtons(true);
  }
  return problems.length === 0;
}

// Enable/disable the Download + Share buttons together.
function setOutputButtons(enabled, disabledTitle) {
  const cfg = [
    ["btnDownload", "Download the KFS as a PDF file to your device"],
    ["btnPrint", "Print the KFS (use 'Save as PDF' in the print dialog)"],
    ["btnShare", "Share the KFS as a PDF file"],
  ];
  cfg.forEach(([id, okTitle]) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = !enabled;
    b.title = enabled ? okTitle : (disabledTitle || "Click Validate first — all mandatory fields must be filled");
  });
}

/* =================================================================
   Bulk import / export (CSV)
   ================================================================= */
// Canonical column order for the CSV template and import. Header == field id.
const CSV_COLUMNS = [
  "proposalNo", "loanType", "amount", "disbursalDate", "disbursalSchedule", "disbursalClause",
  "tenureMonths", "moratoriumMonths", "payInterestMonthly", "frequency", "roundEmi",
  "rateMode", "hybridFixedRate", "hybridFixedYears", "benchmark", "benchmarkRate", "spread", "resetMonths", "flatRate",
  "re_processing", "re_insurance", "re_valuation", "re_other",
  "tp_processing", "tp_insurance", "tp_valuation", "tp_other",
  "type_processing", "type_insurance", "type_valuation", "type_other",
  "type_b_processing", "type_b_insurance", "type_b_valuation", "type_b_other",
  "c_penal", "c_otherpenal", "c_foreclosure", "c_switching", "c_other",
  "q_cooling", "q_recovery", "q_grm", "q_groName", "q_groPhone", "q_groEmail", "q_transfer",
  "q_origRe", "q_origProp", "q_partnerRe", "q_partnerProp", "q_blended", "q_lsp",
];

let bulkMode = false;

function csvEscape(v) {
  v = (v === undefined || v === null) ? "" : String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

// Minimal RFC-4180 CSV parser (handles quoted fields, escaped quotes, CRLF).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  text = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  row.push(field); rows.push(row);
  // Drop fully-empty trailing lines.
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ""));
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Build a sensible PDF file name from the loan proposal / account number.
function pdfFileName() {
  const slug = (s) => String(s || "").trim().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  if (bulkMode) return "KFS_all_loans.pdf";
  const acct = slug(document.getElementById("proposalNo") && document.getElementById("proposalNo").value);
  // KFS_{account no}, skipping the account part when blank.
  const parts = ["KFS", acct].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

// Render the current KFS output element into a PDF Blob via html2pdf.
async function generatePdfBlob() {
  const el = document.getElementById("kfsOutput");
  if (!el || !el.innerHTML.trim()) {
    alert("There is nothing to export yet. Fill the form and click Validate first.");
    return null;
  }
  if (typeof html2pdf === "undefined") {
    alert("The PDF library could not be loaded.\nPlease check your internet connection and refresh the page.");
    return null;
  }
  const opt = {
    margin: 10,
    filename: pdfFileName(),
    image: { type: "jpeg", quality: 0.98 },
    // scrollX/scrollY/y pin the capture origin to the top of the content; without
    // these, html2canvas uses the current page scroll offset and leaves blank pages.
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      y: 0,
      windowWidth: document.documentElement.scrollWidth,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    // Force a fresh A4 page before every section (except the first, to avoid a blank
    // leading page) via an explicit selector. We deliberately DO NOT enable "css" mode:
    // the sections already carry `break-before: page`, so css mode + the explicit
    // selector would each insert a break => duplicate/blank pages. The before/avoid
    // selectors are honoured regardless of mode. `avoid` keeps headings/rows intact.
    pagebreak: {
      mode: ["legacy"],
      before: ".kfs-page:not(:first-of-type)",
      // Only keep table rows intact. Section titles sit at the top of their forced-break
      // page, so listing them in `avoid` made html2pdf insert an extra (blank) break.
      avoid: ["tr"],
    },
  };
  // Apply print-style pagination during capture, then restore the screen layout.
  document.body.classList.add("pdf-export");
  // #region agent log
  try {
    const PX_PER_MM = 96 / 25.4;
    const usableWmm = 210 - 2 * opt.margin;
    const usableHmm = 297 - 2 * opt.margin;
    const elWpx = el.scrollWidth || el.offsetWidth || 1;
    const mmPerPx = usableWmm / elWpx;
    const beforeSel = opt.pagebreak && opt.pagebreak.before;
    const beforeIds = beforeSel ? Array.from(el.querySelectorAll(beforeSel)).map(x => x.id) : [];
    const pages = Array.from(el.querySelectorAll(".kfs-page")).map(p => {
      const cs = getComputedStyle(p);
      const titles = Array.from(p.querySelectorAll(".kfs-title")).map(t => ({
        txt: (t.textContent || "").trim().slice(0, 20),
        topPx: t.offsetTop, hPx: t.offsetHeight,
      }));
      return {
        id: p.id, hPx: p.offsetHeight,
        pdfHmm: Math.round(p.offsetHeight * mmPerPx * 10) / 10,
        breakBefore: cs.breakBefore, pageBreakBefore: cs.pageBreakBefore,
        breakInside: cs.breakInside, titles,
      };
    });
    fetch('http://127.0.0.1:7700/ingest/e2db97ea-78fe-4881-bdf6-14640750a456', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '62b464' }, body: JSON.stringify({ sessionId: '62b464', runId: 'post-fix6', hypothesisId: 'J', location: 'kfs.js:1080', message: 'pdf export page metrics', data: { h2pdfVersion: (window.html2pdf && (html2pdf.version || (html2pdf.Worker && 'present'))) || 'n/a', pagebreak: opt.pagebreak, beforeSel, beforeIds, margin: opt.margin, elWpx, usableWmm, usableHmm, PX_PER_MM, pages }, timestamp: Date.now() }) }).catch(() => { });
  } catch (e) {
    fetch('http://127.0.0.1:7700/ingest/e2db97ea-78fe-4881-bdf6-14640750a456', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '62b464' }, body: JSON.stringify({ sessionId: '62b464', runId: 'post-fix2', hypothesisId: 'D,F', location: 'kfs.js:1080', message: 'pdf export metrics ERROR', data: { err: String(e) }, timestamp: Date.now() }) }).catch(() => { });
  }
  // #endregion
  try {
    const worker = html2pdf().set(opt).from(el).toPdf();
    const pdf = await worker.get("pdf");
    // #region agent log
    try {
      const numPages = pdf.internal.getNumberOfPages();
      fetch('http://127.0.0.1:7700/ingest/e2db97ea-78fe-4881-bdf6-14640750a456', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '62b464' }, body: JSON.stringify({ sessionId: '62b464', runId: 'post-fix6', hypothesisId: 'J', location: 'kfs.js:generatePdfBlob', message: 'actual pdf page count', data: { numPages, pageW: pdf.internal.pageSize.getWidth(), pageH: pdf.internal.pageSize.getHeight() }, timestamp: Date.now() }) }).catch(() => { });
    } catch (e) { }
    // #endregion
    return pdf.output("blob");
  } finally {
    document.body.classList.remove("pdf-export");
  }
}

// Run an async PDF action while showing a "busy" state on the trigger button.
async function withBusy(btnId, fn) {
  const btn = document.getElementById(btnId);
  const old = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;
  if (btn) { btn.disabled = true; btn.innerHTML = "…"; }
  try { await fn(); }
  finally { if (btn && old) { btn.innerHTML = old.html; btn.disabled = old.disabled; } }
}

// Download the KFS as a PDF file to the user's device.
async function downloadPdf() {
  await withBusy("btnDownload", async () => {
    const blob = await generatePdfBlob();
    if (blob) downloadBlob(pdfFileName(), blob, "application/pdf");
  });
}

// Generate a PDF and share it via the Web Share API,
// falling back to a normal download when file-sharing isn't supported.
async function sharePdf() {
  await withBusy("btnShare", async () => {
    const blob = await generatePdfBlob();
    if (!blob) return;
    const filename = pdfFileName();
    const file = new File([blob], filename, { type: "application/pdf" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Key Fact Statement (KFS)", text: "Key Fact Statement" });
      } else {
        downloadBlob(filename, blob, "application/pdf");
        alert("Sharing files isn't supported on this device/browser, so the PDF was downloaded instead.\nYou can attach it manually to email or any messaging app.");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user dismissed the share sheet
      alert("Could not share the PDF.\n" + err);
    }
  });
}

// Build a template CSV: header row + two sample loan rows from current defaults.
function buildTemplateCSV() {
  // Sample 1 = an ECLGS 5.0 example. The form leaves loan-/borrower-specific fields
  // blank by default, so fill them here to keep the template a complete example.
  const sample = Object.assign({}, DEFAULTS, {
    proposalNo: "54540610002026",
    amount: "2,00,000",
    c_other: "Nil",
    q_groName: "Mr. Rakesh Sharma",
    q_groPhone: "1800-123-4567",
    q_groEmail: "grievance.officer@abc.bank.in",
  });
  // A second example row so the multi-loan format is obvious.
  // A second row using a different product, to show the multi-loan / multi-product
  // format. Values mirror the MSME Term Loan auto-fill profile.
  const sample2 = Object.assign({}, DEFAULTS, {
    proposalNo: "54540610002027",
    loanType: "MSME Term Loan",
    amount: "1000000",
    tenureMonths: "84",
    moratoriumMonths: "6",
    payInterestMonthly: "Yes",
    rateMode: "Floating",
    benchmark: "RBI Policy Repo Rate",
    benchmarkRate: "6.5",
    spread: "3",
    re_processing: "10000",
    tp_valuation: "5000",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)",
    c_switching: "0.50% of outstanding principal + applicable GST",
    c_other: "NACH/cheque dishonour: \u20b9500 per instance + GST",
    q_groName: "Ms. Anita Verma",
    q_groPhone: "1800-222-3333",
    q_groEmail: "grievance.officer@xyz.bank.in",
    q_transfer: "Yes",
  });
  const header = CSV_COLUMNS.join(",");
  const toLine = (obj) => CSV_COLUMNS.map(id => csvEscape(obj[id] !== undefined ? obj[id] : "")).join(",");
  // BOM so Excel opens UTF-8 (₹ symbol etc.) correctly.
  return "\ufeff" + [header, toLine(sample), toLine(sample2)].join("\r\n") + "\r\n";
}

function setCsvReport(html, cls) {
  const box = document.getElementById("csvReport");
  if (!box) return;
  box.className = "csv-report " + (cls || "");
  box.innerHTML = html;
}

function processCSVText(text) {
  let rows;
  try { rows = parseCSV(text); } catch (e) { setCsvReport("Could not read the CSV file.", "error"); return; }
  if (!rows.length) { setCsvReport("The CSV file is empty.", "error"); return; }

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ""; });
    return o;
  });

  if (!dataRows.length) { setCsvReport("No data rows found below the header.", "error"); return; }

  const results = dataRows.map((row, i) => {
    const s = (id) => (row[id] === undefined || row[id] === null ? "" : String(row[id]).trim());
    return {
      n: i + 1,
      name: s("proposalNo") || ("Row " + (i + 1)),
      errors: validateValues(s),
      row,
    };
  });

  const valid = results.filter(r => r.errors.length === 0);
  const invalid = results.filter(r => r.errors.length > 0);

  // Report
  let html = `<div class="csv-rep-title">${results.length} row${results.length > 1 ? "s" : ""} read &mdash; `
    + `<span class="ok-txt">${valid.length} valid</span>, `
    + `<span class="${invalid.length ? "err-txt" : ""}">${invalid.length} with errors</span></div>`;
  if (invalid.length) {
    html += invalid.map(r =>
      `<div class="csv-rep-row err"><b>Row ${r.n} (${r.name})</b><ul>${r.errors.map(e => `<li>${e}</li>`).join("")}</ul></div>`
    ).join("");
  }
  if (valid.length) {
    html += `<div class="csv-rep-row ok">Generated KFS for ${valid.length} loan${valid.length > 1 ? "s" : ""}. Use <b>Download / Print PDF</b> to export all.</div>`;
  } else {
    html += `<div class="csv-rep-row err">No valid rows to generate. Fix the errors above and re-import.</div>`;
  }
  setCsvReport(html, invalid.length ? "error" : "ok");

  // Render valid loans (all in one document, each separated for print).
  const printBtn = document.getElementById("btnPrint");
  if (valid.length) {
    bulkMode = true;
    const out = valid.map((r, i) => {
      const inp = rowInput(r.row);
      const res = calculate(inp);
      const sep = `<div class="borrower-sep no-print">Loan ${i + 1} of ${valid.length}${inp.proposalNo ? ": " + inp.proposalNo : ""}</div>`;
      return sep + buildKfsHtml(inp, res);
    }).join("");
    document.getElementById("kfsOutput").innerHTML = out;
    addPageControls();
    setOutputButtons(true, "");
    printBtn.title = `Download / Print the KFS for all ${valid.length} loan(s)`;
  } else {
    bulkMode = false;
    setOutputButtons(false);
  }
}

/* =================================================================
   Card → KFS section navigation
   When the user moves into a Loan-Inputs card, scroll the matching
   section of the rendered KFS into view (and briefly highlight it).
   ================================================================= */
function scrollToKfsSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const page = el.closest(".kfs-page") || el;
  page.classList.add("kfs-flash");
  setTimeout(() => page.classList.remove("kfs-flash"), 1300);
}

function setupCardNavigation() {
  let lastTarget = null;
  document.querySelectorAll(".form-panel fieldset[data-target]").forEach(fs => {
    const go = () => {
      const target = fs.getAttribute("data-target");
      if (!target || target === lastTarget) return;
      lastTarget = target;
      scrollToKfsSection(target);
    };
    // focusin covers clicking/tabbing into a field; click covers the card chrome.
    fs.addEventListener("focusin", go);
    fs.addEventListener("click", go);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const printBtn = document.getElementById("btnPrint");
  captureDefaults();
  restoreInputs();
  document.querySelectorAll(".form-panel input, .form-panel select").forEach(el => {
    if (el.type === "file") return; // file inputs are handled separately
    const onEdit = () => {
      el.classList.remove("invalid");
      if (el.id === "amount") formatAmount();
      // Editing the form returns to single-borrower mode.
      if (bulkMode) {
        bulkMode = false;
        const rep = document.getElementById("csvReport");
        if (rep) { rep.className = "csv-report hidden"; rep.innerHTML = ""; }
        const csvFile = document.getElementById("csvFile");
        if (csvFile) csvFile.value = "";
      }
      // Data changed -> require a fresh validation before printing.
      setOutputButtons(false, "Click Validate first — all mandatory fields must be filled before printing/sharing");
      toggleRateMode();
      toggleCombos();
      saveInputs();
      refresh();
    };
    el.addEventListener("input", onEdit);
    el.addEventListener("change", onEdit);
  });
  // Selecting a Type of Loan auto-fills indicative product defaults (RBI/bank norms).
  const loanTypeSel = document.getElementById("loanType");
  if (loanTypeSel) {
    loanTypeSel.addEventListener("change", () => {
      applyLoanTypeProfile(loanTypeSel.value);
      formatAmount();
      toggleRateMode();
      toggleCombos();
      setOutputButtons(false, "Click Validate first — all mandatory fields must be filled before printing/sharing");
      saveInputs();
      refresh();
    });
  }
  const resetBtn = document.getElementById("btnReset");
  if (resetBtn) resetBtn.addEventListener("click", resetToDefaults);
  const guideBtn = document.getElementById("btnGuide");
  if (guideBtn) guideBtn.addEventListener("click", showGuide);

  // Mobile / desktop view toggle (remembered across sessions).
  const mobileBtn = document.getElementById("btnMobile");
  const applyMobile = (on) => {
    document.body.classList.toggle("mobile-mode", on);
    if (mobileBtn) {
      mobileBtn.classList.toggle("active", on);
      mobileBtn.setAttribute("aria-pressed", on ? "true" : "false");
      // Icon-only: phone icon means "switch to mobile", monitor icon means "switch to desktop".
      mobileBtn.innerHTML = on ? "\uD83D\uDDA5\uFE0F" : "\uD83D\uDCF1";
      const tip = on ? "Switch to desktop view" : "Switch to mobile view";
      mobileBtn.setAttribute("title", tip);
      mobileBtn.setAttribute("aria-label", tip);
    }
  };
  let mobilePref = false;
  try { mobilePref = localStorage.getItem("kfsMobileMode") === "1"; } catch (e) { /* ignore */ }
  applyMobile(mobilePref);
  if (mobileBtn) mobileBtn.addEventListener("click", () => {
    const on = !document.body.classList.contains("mobile-mode");
    applyMobile(on);
    try { localStorage.setItem("kfsMobileMode", on ? "1" : "0"); } catch (e) { /* ignore */ }
  });

  // Bulk CSV: template download + import.
  const tplBtn = document.getElementById("btnCsvTemplate");
  if (tplBtn) tplBtn.addEventListener("click", () => downloadBlob("KFS_template.csv", buildTemplateCSV()));
  const csvFile = document.getElementById("csvFile");
  if (csvFile) csvFile.addEventListener("change", () => {
    const f = csvFile.files && csvFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => processCSVText(reader.result);
    reader.onerror = () => setCsvReport("Could not read the selected file.", "error");
    reader.readAsText(f);
  });

  printBtn.addEventListener("click", () => {
    // In bulk mode the rendered borrowers are already validated.
    if (bulkMode) { window.print(); return; }
    // Final safety check: never print with missing mandatory data.
    if (!validateForm()) {
      alert("Please fill all mandatory fields before printing.\nThe missing fields are highlighted in red.");
      return;
    }
    window.print();
  });

  const downloadBtn = document.getElementById("btnDownload");
  if (downloadBtn) downloadBtn.addEventListener("click", () => {
    if (!bulkMode && !validateForm()) {
      alert("Please fill all mandatory fields before downloading.\nThe missing fields are highlighted in red.");
      return;
    }
    downloadPdf();
  });

  const shareBtn = document.getElementById("btnShare");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    if (!bulkMode && !validateForm()) {
      alert("Please fill all mandatory fields before sharing.\nThe missing fields are highlighted in red.");
      return;
    }
    sharePdf();
  });

  document.getElementById("fabValidate").addEventListener("click", validateForm);

  // Clicking a (?) marker shows an in-page help popup describing the field.
  document.querySelectorAll(".form-panel .help").forEach(h => {
    h.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // The (?) lives either inside a field <label> or beside a card <legend>
      // (a card-level "universal" help covering the fields shown on one row).
      const container = h.closest("label") || h.closest("legend");
      let name = "";
      if (container) {
        name = [...container.childNodes]
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      }
      showHelp(name || "Field help", h.getAttribute("title") || "");
    });
  });
  setupCardNavigation();
  formatAmount();
  toggleRateMode();
  toggleCombos();
  refresh();
});
