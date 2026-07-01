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
    sanctionDate: s("sanctionDate"),
    disbursalDate: s("disbursalDate"),
    disbursalSchedule: s("disbursalSchedule"),
    disbursalClause: s("disbursalClause"),
    tenureMonths: n("tenureMonths"),
    moratoriumMonths: n("moratoriumMonths"),
    payInterestMonthly: s("payInterestMonthly") || "No",
    moratoriumInstalment: s("moratoriumInstalment") || "Pay interest only",
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
  const rp = r / ppy; // periodic rate

  const reTotal = inp.re.processing + inp.re.insurance + inp.re.valuation + inp.re.other;
  const tpTotal = inp.tp.processing + inp.tp.insurance + inp.tp.valuation + inp.tp.other;
  const totalCharges = reTotal + tpTotal;
  const netDisbursed = P - totalCharges;

  const isHybrid = inp.rateMode === "Hybrid";
  const rp2 = isHybrid ? inp.floatRate / ppy : rp;

  // Tenure (months) = repayment phase only — number of equated instalment (EPI) periods,
  // excluding the MoP. The MoP is additional calendar time before those EPIs begin.
  const morPeriods = Math.max(0, Math.round((inp.moratoriumMonths || 0) * ppy / 12));
  const repayN = Math.max(1, Math.round((inp.tenureMonths / 12) * ppy));
  const totalN = repayN + morPeriods;

  // Hybrid: fixed-rate phase length within the repayment period (after MoP).
  const kFull = isHybrid ? Math.round(inp.hybridFixedYears * ppy) : 0;
  const k = isHybrid ? Math.max(0, Math.min(kFull, repayN)) : 0;

  const mpp = 12 / ppy; // months per instalment period
  // Everything is derived from the Date of Disbursement. The first instalment falls on the
  // END of the disbursement month itself; its interest covers only the days from the
  // disbursement date to that month-end. Any MoP shifts the first EPI further out.
  const commenceMonths = inp.moratoriumMonths || 0;

  // Accrual base date for the Actual/365 day-count. The Date of Disbursement drives it; when
  // that is left blank (it is optional) we fall back to the mandatory Date of Sanction so the
  // moratorium and EPI interest are still accrued on a true Actual/365 basis rather than a
  // flat nominal 1/period approximation.
  const accrualBase = inp.disbursalDate || inp.sanctionDate || "";

  // First-instalment base date = disbursement month (month-end), shifted by any MoP.
  let baseDate = null;
  if (accrualBase) {
    const d = new Date(accrualBase);
    if (!isNaN(d)) { d.setMonth(d.getMonth() + commenceMonths); baseDate = d; }
  }

  // Month-end due date (a Date) for schedule row index p (0-based). Rows 0..morPeriods-1
  // are moratorium rows; row morPeriods is the first EPI (offset 0 from baseDate).
  const dueDateOf = (p) => eomDate(baseDate, Math.round((p - morPeriods) * mpp));
  const MS_PER_DAY = 86400000;
  const daysBetween = (a, b) => (a && b ? Math.round((b - a) / MS_PER_DAY) : 0);
  // Days from the accrual base date to the first schedule due date (end of that month).
  let commenceDays = 0;
  if (accrualBase && baseDate) {
    const dd = new Date(accrualBase);
    if (!isNaN(dd)) commenceDays = Math.max(0, daysBetween(dd, dueDateOf(0)));
  }
  // Interest accrues from the accrual base date up to the first due date, so a mid-month
  // disbursal (or sanction, when disbursal is blank) yields a correctly shortened first period.
  let accrualStart = null;
  if (accrualBase) {
    const d = new Date(accrualBase);
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
  let emiPhase1 = roundEMI(-Fin.pmt(rp, repayN, balAfterMor));
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

  let totalPrincipalRepaid = 0;
  for (const row of schedule) {
    if (row.principal > 0) totalPrincipalRepaid += row.principal;
  }
  const interestTenorMo = Math.max(1, inp.tenureMonths || 1);
  const principalTenorMo = Math.max(1, (inp.tenureMonths || 0) - (inp.moratoriumMonths || 0));
  const avgPrincipalPerMonth = totalPrincipalRepaid / principalTenorMo;
  const avgInterestPerMonth = totalInterest / interestTenorMo;

  // Stamp a month-end due date string on every schedule row.
  schedule.forEach((row, idx) => {
    row.dueDate = endOfMonthFrom(baseDate, Math.round((idx - morPeriods) * mpp));
  });
  const commencementDate = baseDate ? endOfMonthFrom(baseDate, 0) : addMonths(inp.disbursalDate, commenceMonths);

  return {
    P, r, n: repayN, totalN, morPeriods, moratoriumMonths: inp.moratoriumMonths || 0, interestServiced: serviceInterest, balAfterMor,
    emi, emiPhase1, emiPhase2, k, rp2, isHybrid,
    reTotal, tpTotal, totalCharges, apr,
    emi25, tenure25, totalInterest, totalPrincipalRepaid, principalTenorMo, interestTenorMo,
    avgPrincipalPerMonth, avgInterestPerMonth,
    netDisbursed, totalPayable,
    schedule, commencementDate, daysToCommence: commenceDays,
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
  const repayMo = inp.tenureMonths || 0;
  const morMo = inp.moratoriumMonths || 0;
  const totalMo = repayMo + morMo;
  let tenureTxt;
  if (morMo > 0) {
    tenureTxt = `${totalMo} Month${totalMo == 1 ? "" : "s"} (${repayMo} repayment + ${morMo} MoP)`;
    if (totalMo % 12 === 0 && totalMo >= 12) tenureTxt += ` (${totalMo / 12} Yr${totalMo / 12 == 1 ? "" : "s"} total)`;
  } else {
    tenureTxt = `${repayMo} Month${repayMo == 1 ? "" : "s"}${repayMo % 12 === 0 && repayMo >= 12 ? ` (${repayMo / 12} Yr${repayMo / 12 == 1 ? "" : "s"})` : ""}`;
  }

  const part1 = `
  <article class="kfs-page" id="part1">
    <div class="kfs-annex">Annexure-A</div>
    <div class="kfs-title">
      <div class="kfs-main">KEY FACTS STATEMENT (KFS)</div>
      <div class="kfs-sub">Part-1 (Interest Rate and Fees/Charges)</div>
    </div>
    <table class="kfs-table">
      <tr id="p1-s1"><td class="sn main">1</td><td colspan="3" class="nestcell">
        <table class="kfs-table nested s1grid">
          <tr>
            <td class="lbl">Loan proposal / Account No.</td>
            <td class="val">${inp.proposalNo || "-"}</td>
            <td class="lbl">Type of Loan</td>
            <td class="val">${inp.loanType || "-"}</td>
          </tr>
          <tr>
            <td class="lbl">Date of Sanction</td>
            <td class="val">${fmtDate(inp.sanctionDate)}</td>
            <td class="lbl">Date of Disbursement</td>
            <td class="val">${disbDate}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td class="sn main">2</td><td class="lbl">Sanctioned Loan amount (in Rupees)</td><td class="val" colspan="2">₹ ${fmtMoney(res.P)} <span class="muted">(${res.amountWords})</span></td></tr>
      <tr><td class="sn main">3</td><td class="lbl">Disbursal schedule<br><span class="muted">(i) Disbursement in stages or 100% upfront. (ii) If it is stage wise, mention the clause of loan agreement having relevant details.</span></td><td class="val" colspan="2">${inp.disbursalSchedule}${inp.disbursalClause ? " &mdash; " + inp.disbursalClause : ""}</td></tr>
      <tr id="p1-s4"><td class="sn main">4</td><td class="lbl">Loan term (year/months/days)</td><td class="val" colspan="2">${tenureTxt}${res.moratoriumMonths ? ` <span class="muted">(${res.interestServiced ? "during the MoP the borrower services the monthly accrued interest" : "during the MoP accrued interest is capitalised to the outstanding principal each month"})</span>` : ""}</td></tr>
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
            <td>${res.commencementDate}<br><span class="muted">(after ${res.daysToCommence} days${res.moratoriumMonths ? ` + ${res.moratoriumMonths}-month MoP` : ""})</span></td>
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
      <tr><td class="sn sub">d)</td><td class="sub-lbl">Commencement of repayments, post sanction (Sl No. 5 of the KFS template &ndash; Part 1)</td><td>${res.daysToCommence} days${res.moratoriumMonths ? ` + ${res.moratoriumMonths}-month MoP` : ""} (${res.commencementDate})</td></tr>
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
  </article>`;

  // For serviced-interest moratorium rows, the "Instalment during Moratorium" option controls
  // how the INSTALMENT column is displayed (display-only; computation unchanged). The Interest
  // column always shows the actual computed (accrued) interest.
  //  • "Pay interest only"          -> the text "Pay interest only"
  //  • "Computed interest"          -> the computed interest amount (as accrued)
  //  • "Add 0 (Zero) to instalment" -> ₹ 0
  //  • any other (custom) text      -> shown verbatim
  const morLabel = inp.moratoriumInstalment || "";
  const isMorServiced = (s) => s.moratorium && s.interestPaid;
  const morInstalmentCell = (s) => {
    if (!isMorServiced(s)) return "₹ " + fmtMoney(s.instalment);
    if (morLabel === "Pay interest only") return '<span class="muted">Pay interest only</span>';
    if (morLabel === "Add 0 (Zero) to instalment") return "₹ " + fmtMoney(0);
    if (morLabel === "Computed interest" || !morLabel) return "₹ " + fmtMoney(s.instalment);
    return `<span class="muted">${morLabel}</span>`;
  };
  const rows = res.schedule.map(s => `
      <tr${s.moratorium ? ' class="mor-row"' : ""}>
        <td>${s.no}</td>
        <td>₹ ${fmtMoney(s.outstanding)}</td>
        <td>${s.moratorium ? '<span class="muted">MoP<sup>&dagger;</sup></span>' : "₹ " + fmtMoney(s.principal)}</td>
        <td>₹ ${fmtMoney(s.interest)}</td>
        <td>${morInstalmentCell(s)}</td>
      </tr>`).join("");

  const annexure = `
  <article class="kfs-page" id="annexure">
    <div class="kfs-annex">Annexure-A(2)</div>
    <div class="kfs-title"><div class="kfs-main">ILLUSTRATIVE REPAYMENT SCHEDULE UNDER EQUATED PERIODIC INSTALMENT</div><div class="kfs-sub">For the hypothetical loan illustrated in Annexure-A(1)</div><div class="kfs-cite"><sup>&dagger;</sup> MoP = Moratorium Period &mdash; no principal is repaid during this period; ${res.interestServiced ? "interest is serviced (paid) monthly by the borrower." : "interest is capitalised to the outstanding principal each month."}</div></div>
    <table class="kfs-table schedule">
      <thead>
        <tr class="subhead">
          <th>Instalment No</th><th>Outstanding Principal (in Rupees)</th>
          <th>Principal (in Rupees)</th><th>Interest (in Rupees)</th><th>Instalment (in Rupees)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
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
// Keep the APR input in sync. By default APR is auto-calculated and shown read-only;
// when the user unticks "Auto" they can type their own APR, which is then used as-is
// in the KFS. Mutates res.apr so render() picks up a manual override.
function syncApr(res) {
  const aprInput = document.getElementById("aprOverride");
  const autoChk = document.getElementById("aprAuto");
  if (!aprInput) return;
  const auto = !autoChk || autoChk.checked;
  aprInput.readOnly = auto;
  if (auto) {
    // Show the freshly computed APR (blank if it could not be computed).
    aprInput.value = (typeof res.apr === "number" && isFinite(res.apr))
      ? (res.apr * 100).toFixed(2)
      : "";
    return;
  }
  // Manual override: use the entered percentage when valid, otherwise fall back to the
  // computed value so the KFS is never left blank.
  const v = parseFloat(String(aprInput.value || "").replace(/,/g, ""));
  if (isFinite(v)) res.apr = v / 100;
}

function refresh() {
  const inp = readInput();
  const res = calculate(inp);
  syncApr(res);
  render(inp, res);
  const avgPrEl = document.getElementById("avgPrincipalPerMonth");
  const avgIntEl = document.getElementById("avgInterestPerMonth");
  if (avgPrEl) avgPrEl.textContent = "₹ " + fmtMoney(res.avgPrincipalPerMonth);
  const avgPrTag = document.getElementById("avgPrincipalMonthTag");
  if (avgPrTag) avgPrTag.textContent = ` (${res.principalTenorMo} Month)`;
  if (avgIntEl) avgIntEl.textContent = "₹ " + fmtMoney(res.avgInterestPerMonth);
  const avgIntTag = document.getElementById("avgInterestMonthTag");
  if (avgIntTag) avgIntTag.textContent = ` (${res.interestTenorMo} Month)`;
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

// Show/hide the MoP-related fields based on the Moratorium Period:
//  - With no MoP (<= 0) the "Pay interest monthly during MoP?" question is irrelevant, so hide it.
//  - "Instalment during Moratorium" is only meaningful when there IS a MoP and interest is
//    serviced monthly during it ("Pay interest monthly during MoP?" = Yes).
function toggleMoratoriumInstalment() {
  const hasMoP = (parseFloat(str("moratoriumMonths")) || 0) > 0;
  const payField = document.getElementById("payInterestMonthlyField");
  if (payField) payField.classList.toggle("hidden", !hasMoP);
  const instField = document.getElementById("moratoriumInstalmentField");
  if (instField) instField.classList.toggle("hidden", !(hasMoP && str("payInterestMonthly") === "Yes"));
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
    amount: "2,00,000", tenureMonths: "48", moratoriumMonths: "12", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_EBLR, benchmarkRate: "8.25", spread: "0.75", resetMonths: "3",
    re_processing: "0", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (no foreclosure / prepayment charges \u2014 ECLGS)", c_switching: "Nil",
    c_other: "Nil", q_cooling: "Not applicable", q_transfer: "No",
  },
  // MSME Term Loan: capex term loan, repo-linked, 7-yr tenure, short moratorium, ~1% processing.
  "MSME Term Loan": {
    amount: "10,00,000", tenureMonths: "78", moratoriumMonths: "6", payInterestMonthly: "Yes",
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
    amount: "15,00,000", tenureMonths: "66", moratoriumMonths: "6", payInterestMonthly: "Yes",
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
    amount: "5,00,000", tenureMonths: "54", moratoriumMonths: "6", payInterestMonthly: "Yes",
    frequency: "Monthly", rateMode: "Floating", benchmark: _BM_REPO, benchmarkRate: "6.5", spread: "2.75", resetMonths: "3",
    re_processing: "0", re_insurance: "0", re_valuation: "0", re_other: "0",
    tp_processing: "0", tp_insurance: "0", tp_valuation: "0", tp_other: "0",
    c_penal: "2% p.a. on overdue instalment amount", c_otherpenal: "Nil",
    c_foreclosure: "Nil (floating-rate loan to individual / MSE borrower)", c_switching: "Nil",
    c_other: "Nil", q_cooling: "Not applicable", q_transfer: "No",
  },
  // Stand-Up India: SC/ST/women, composite loan, 7-yr tenure incl. up to 18-month moratorium.
  "Stand-Up India Loan": {
    amount: "25,00,000", tenureMonths: "66", moratoriumMonths: "18", payInterestMonthly: "Yes",
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
    amount: "10,00,000", tenureMonths: "54", moratoriumMonths: "6", payInterestMonthly: "Yes",
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

// While true, the Date of Sanction mirrors the Date of Disbursement. The first time the
// user edits the sanction date themselves, this flips to false and the two decouple.
let sanctionDateAuto = true;

function captureDefaults() {
  document.querySelectorAll(".form-panel input, .form-panel select").forEach(el => {
    if (el.id && el.type !== "file") DEFAULTS[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
}

function saveInputs() {
  const data = {};
  document.querySelectorAll(".form-panel input, .form-panel select").forEach(el => {
    if (el.id && el.type !== "file") data[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}

function restoreInputs() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) { data = null; }
  if (!data) return;
  Object.entries(data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el || el.type === "file") return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  });
}

function resetToDefaults() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  sanctionDateAuto = true; // back to mirroring the disbursement date
  Object.entries(DEFAULTS).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  });
  document.querySelectorAll(".form-panel .invalid").forEach(el => el.classList.remove("invalid"));
  const box = document.getElementById("validateMsg");
  if (box) { box.className = "validate-box hidden"; box.innerHTML = ""; }
  const fab = document.getElementById("fabValidate");
  if (fab) fab.classList.remove("fab-error", "fab-ok");
  formatAmount();
  toggleRateMode();
  toggleCombos();
  toggleMoratoriumInstalment();
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
    `<li><b>Fill in the loan details.</b> Inputs are grouped into cards by KFS serial number (Sl. 1&ndash;10, then Part-2). Every field has a small <span class="guide-q">?</span> marker &mdash; click it to see what that field means. <b>Field names in <span style="color:#800000">maroon</span> feed the APR.</b></li>` +
    `<li><b>Sanction &amp; Disbursement dates.</b> Both start blank. The <i>Date of Sanction</i> is <b>mandatory</b> and must be on or before the <i>Date of Disbursement</i>. The <i>Date of Disbursement</i> is optional (e.g. a KFS issued at sanction stage). The two stay consistent automatically: setting a disbursement date fills the sanction date (until you edit sanction yourself); and if a sanction date is later than the disbursement date (or the disbursement is still blank), the disbursement date is set equal to the sanction date.</li>` +
    `<li><b>Jump to a section.</b> Click any input card and the matching section of the KFS preview scrolls into view and briefly highlights.</li>` +
    `<li><b>Pick the rate type.</b> Choose <i>Floating</i>, <i>Fixed</i>, or <i>Hybrid</i> (fixed for an initial period, then floating). Relevant rate fields appear automatically.</li>` +
    `<li><b>Fees &amp; charge nature.</b> Enter the amount and the <i>One-time / Recurring</i> nature side-by-side for <i>Payable to RE (8A)</i> and <i>Third Party (8B)</i>.</li>` +
    `<li><b>APR.</b> The <i>Annual Percentage Rate</i> is auto-calculated from the loan terms and fees (IRR / reducing-balance method). Untick <i>Auto</i> to type your own APR &mdash; it is then used as-is in the KFS (Sl. 9) and the APR illustration.</li>` +
    `<li><b>Use dropdowns.</b> Many fields are dropdowns; choose <i>Other (specify)</i> to type a custom value.</li>` +
    `<li><b>Repayment tenure vs MoP.</b> <i>Repayment tenure (Months)</i> is the number of equated instalment (EPI) periods <b>after</b> the moratorium &mdash; the same basis most core banking systems use for EMI. The MoP is entered separately; total facility term on the KFS = repayment tenure + MoP.</li>` +
    `<li><b>Moratorium options.</b> When a <i>Moratorium Period (MoP)</i> is set, choose whether interest is <i>paid monthly</i> (principal unchanged) or <i>capitalised</i>. If paid monthly, <i>Instalment during Moratorium</i> controls how the MoP rows read in the schedule (<i>Pay interest only</i>, the <i>Computed interest</i>, <i>Add 0</i>, or your own text) &mdash; this is display-only and never changes the calculation.</li>` +
    `<li><b>A4 preview.</b> The on-screen preview shows each section as a real <b>A4 sheet</b> with the same margins as the export, and a faint line marks every page boundary &mdash; so you can see at a glance how many pages each Annexure will take. Each section fits its own A4 page (the long <i>Annexure-A(2)</i> schedule may flow across several).</li>` +
    `<li><b>Click <span class="guide-pill">&#10003; Validate</span></b> (floating button, bottom-right). Missing or invalid mandatory fields are highlighted in red and listed at the top. The Grievance Redressal Officer (GRO) details are optional &mdash; if left blank they show as an amber note and can be added manually later.</li>` +
    `<li><b>Download / Print / Share.</b> These buttons are always clickable and run validation first &mdash; if anything is missing you&rsquo;re asked to complete it before proceeding. <span class="guide-pill">Download</span> and <span class="guide-pill">Share</span> let you choose the format: <b>PDF</b>, <b>Word (.docx)</b> or <b>Word (.doc)</b>. Every Annexure starts on a fresh page and fits a single A4 page (except the <i>Annexure-A(2)</i> schedule, which may flow). <span class="guide-pill">Print Preview (A4)</span> opens a new window showing the exact A4 page layout before you print, and <span class="guide-pill">Print</span> opens the print dialog (use &ldquo;Save as PDF&rdquo;).</li>` +
    `<li><b>Bulk loans (CSV).</b> In <i>Bulk Import</i>: click <span class="guide-pill">Download CSV template</span>, fill <b>one row per loan</b>, then <span class="guide-pill">Import CSV</span>. Every row is validated; valid ones generate a KFS each and invalid ones are listed and skipped.</li>` +
    `<li><b>Auto-save &amp; Reset.</b> Your inputs are saved in this browser automatically. The <span class="guide-pill">Reset all fields</span> card (top of the form) clears them back to the defaults.</li>` +
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
    ["sanctionDate", "Date of Sanction"],
    ["disbursalSchedule", "Disbursement Schedule"],
    ["tenureMonths", "Repayment tenure (Months)", "positive"],
    ["frequency", "Instalment Frequency"],
    ["rateMode", "Rate Type"],
    ["q_recovery", "Recovery agent clause"],
    ["q_grm", "Grievance redressal clause"],
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

// Advisory (non-blocking) fields: recommended for a complete KFS, but they do NOT
// block printing/downloading. The GRO contact details can be filled in manually later.
const ADVISORY_RULES = [
  ["q_groName", "Name of Grievance Redressal Officer (GRO)"],
  ["q_groPhone", "Phone of Grievance Redressal Officer (GRO)", "phone"],
  ["q_groEmail", "Email of Grievance Redressal Officer (GRO)", "email"],
];

// Returns [{ id, msg }] advisory notes for recommended fields that are empty or, when
// filled, have an invalid format. These are surfaced as a soft warning, never blocking.
function advisoryProblems() {
  const out = [];
  ADVISORY_RULES.forEach(([id, label, rule]) => {
    const val = str(id);
    if (val === "") { out.push({ id, msg: label + " — not filled (optional, can be added manually later)" }); return; }
    if (rule === "email" && !EMAIL_RE.test(val)) out.push({ id, msg: label + " — invalid email format" });
    else if (rule === "phone" && !PHONE_RE.test(val)) out.push({ id, msg: label + " — invalid phone number" });
  });
  return out;
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

  if (str("rateMode") === "Hybrid" && tenure > 0 && num("hybridFixedYears") * 12 > tenure)
    out.push({ msg: "Hybrid fixed-rate period must not exceed the Tenure", fields: ["hybridFixedYears", "tenureMonths"] });

  // Sanction must not be dated after disbursement (ISO yyyy-mm-dd compares as text).
  const sanction = str("sanctionDate");
  const disbursal = str("disbursalDate");
  if (sanction && disbursal && sanction > disbursal)
    out.push({ msg: "Date of Sanction cannot be after the Date of Disbursement", fields: ["sanctionDate", "disbursalDate"] });

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
  document.querySelectorAll(".form-panel .invalid, .form-panel .warn").forEach(el => el.classList.remove("invalid", "warn"));

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

  // Advisory (non-blocking) checks: recommended fields that are empty / mis-formatted.
  // These are highlighted amber and listed as a note, but never prevent printing.
  const advisories = advisoryProblems();
  advisories.forEach(a => fieldControl(a.id)?.classList.add("warn"));
  const advisoryHtml = advisories.length
    ? `<div class="vb-advisory"><span class="vb-adv-title">Note — recommended field${advisories.length > 1 ? "s" : ""} not filled (optional, you can add ${advisories.length > 1 ? "these" : "this"} manually later):</span>` +
      `<ul>${advisories.map(a => `<li>${a.msg}</li>`).join("")}</ul></div>`
    : "";

  const box = document.getElementById("validateMsg");
  const fab = document.getElementById("fabValidate");
  fab.classList.remove("fab-error", "fab-ok");
  box.classList.remove("hidden", "error", "ok");

  if (problems.length) {
    box.classList.add("error");
    box.innerHTML =
      `<span class="vb-title">${problems.length} issue${problems.length > 1 ? "s" : ""} to fix:</span>` +
      `<ul>${problems.map(m => `<li>${m}</li>`).join("")}</ul>` +
      `<span>Please correct the highlighted fields before printing.</span>` +
      advisoryHtml;
    fab.classList.add("fab-error");
    setOutputButtons();
    const first = document.querySelector(".form-panel .invalid");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    box.classList.add("ok");
    box.innerHTML = `<span class="vb-title">&#10003; All mandatory fields are filled.</span>The KFS below is ready to download / print.` + advisoryHtml;
    fab.classList.add("fab-ok");
    setOutputButtons();
  }
  return problems.length === 0;
}

// The Download / Print / Share buttons are always clickable; validation is run at
// click time instead (see the click handlers). This keeps them enabled at all times
// and only gates the actual action when mandatory fields are incomplete.
function setOutputButtons() {
  const cfg = [
    ["btnDownload", "Download the KFS — choose PDF or Word (.docx / .doc)"],
    ["btnPreview", "Print preview (A4) — see the page layout before printing"],
    ["btnPrint", "Print the KFS (use 'Save as PDF' in the print dialog)"],
    ["btnShare", "Share the KFS — choose PDF or Word (.docx / .doc)"],
  ];
  cfg.forEach(([id, okTitle]) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = false;
    b.title = okTitle;
  });
}

/* =================================================================
   Bulk import / export (CSV)
   ================================================================= */
// Canonical column order for the CSV template and import. Header == field id.
const CSV_COLUMNS = [
  "proposalNo", "loanType", "amount", "sanctionDate", "disbursalDate", "disbursalSchedule", "disbursalClause",
  "tenureMonths", "moratoriumMonths", "payInterestMonthly", "moratoriumInstalment", "frequency", "roundEmi",
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
    filename: exportFileName("pdf"),
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

  // Shrink-to-fit: keep every section EXCEPT the long repayment schedule (Annexure-A(2))
  // on a single A4 page. html2pdf maps each page's CSS-pixel width to the usable A4 width,
  // so a page fits one sheet when its height ≤ the usable height in that same scale. Any
  // page taller than that is scaled down (transform) just enough to fit; the schedule may
  // still flow across pages. The inline styles are reverted in the finally block.
  const shrunk = [];
  try {
    const usableWmm = 210 - 2 * opt.margin;
    const usableHmm = 297 - 2 * opt.margin;
    const elWpx = el.offsetWidth || el.scrollWidth || 1;
    const maxPageHpx = usableHmm * (elWpx / usableWmm);
    el.querySelectorAll(".kfs-page:not(#annexure)").forEach(p => {
      const h = p.offsetHeight;
      if (h > maxPageHpx) {
        const scale = Math.max(0.5, maxPageHpx / h);
        p.style.transformOrigin = "top left";
        p.style.transform = `scale(${scale})`;
        p.style.height = (h * scale) + "px";
        p.style.overflow = "hidden";
        shrunk.push(p);
      }
    });
  } catch (e) { /* fit is best-effort; fall back to default pagination */ }

  try {
    const worker = html2pdf().set(opt).from(el).toPdf();
    const pdf = await worker.get("pdf");
    return pdf.output("blob");
  } finally {
    shrunk.forEach(p => {
      p.style.transform = "";
      p.style.transformOrigin = "";
      p.style.height = "";
      p.style.overflow = "";
    });
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

// ---- Word (.doc / .docx) export -------------------------------------------------
// Self-contained CSS embedded in the exported Word/HTML document so the KFS tables
// render with the same borders, shading and colours outside the app (CSS variables
// are resolved to literal values; flex footers degrade gracefully in Word).
const EXPORT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: Arial, "Helvetica Neue", sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
.kfs-page.brk { page-break-before: always; }
.kfs-page.fit { page-break-inside: avoid; }
.kfs-page.fit table, .kfs-page.fit tr { page-break-inside: avoid; }
.kfs-annex { display: inline-block; background: #084a8a; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: .5px; padding: 3px 12px; border-radius: 4px; margin-bottom: 8px; }
.kfs-title { text-align: center; margin-bottom: 14px; }
.kfs-main { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
.kfs-sub { font-size: 14px; font-weight: 600; margin-top: 2px; }
.kfs-cite { font-size: 11px; color: #6b7280; margin-top: 4px; }
.kfs-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.kfs-table td, .kfs-table th { border: 1px solid #c9ced6; padding: 6px 9px; vertical-align: top; text-align: left; }
.kfs-table .sn { width: 40px; text-align: center; vertical-align: middle; font-weight: 600; }
.kfs-table .sn.main { font-weight: 700; font-size: 13px; color: #084a8a; background: #f3f6fa; }
.kfs-table .sn.sub { font-weight: 500; font-size: 11px; color: #6b7280; text-align: right; padding-right: 8px; }
.kfs-table .lbl { width: 42%; }
.kfs-table .sub-lbl { padding-left: 18px; color: #333; }
.kfs-table .val { font-weight: 600; }
.kfs-table .subhead td, .kfs-table .subhead th { background: #f3f6fa; font-weight: 600; text-align: center; }
.kfs-table .section-h { background: #eaf1f9; font-weight: 600; text-align: center; }
.kfs-table .totrow td { background: #f7faff; font-weight: 700; }
.muted { color: #6b7280; font-weight: 400; font-size: 11px; }
.kfs-table .nestcell { padding: 0; }
.kfs-table .nested { border: none; }
.kfs-table .nested td { border-left: none; }
.kfs-table .nested tr td:first-child { border-left: none; }
.kfs-table .nested tr td:last-child { border-right: none; }
.kfs-table .nested.s1grid td.lbl { width: 1%; white-space: nowrap; }
.schedule td, .schedule th { text-align: right; }
.schedule td:first-child, .schedule th:first-child { text-align: center; }
.schedule tr.mor-row { background: #fff7e6; }
.kfs-notes { margin-top: 10px; font-size: 10px; line-height: 1.45; color: #6b7280; }
.kfs-notes p { margin: 2px 0; }
.kfs-table sup, .kfs-notes sup { color: #8b0000; font-weight: 800; }
`;

// Clone the rendered KFS output and prepare it for export/preview: strip the on-screen
// Edit buttons / no-print chrome, force a fresh page before every section (except the
// first, so no blank leading page) and keep each section on one page (except the long
// Annexure-A(2) schedule), and force visible table borders for Word. Returns the cleaned
// inner HTML, or null when there is nothing to export.
function buildExportBodyHtml() {
  const el = document.getElementById("kfsOutput");
  if (!el || !el.innerHTML.trim()) {
    alert("There is nothing to export yet. Fill the form and click Validate first.");
    return null;
  }
  const clone = el.cloneNode(true);
  clone.querySelectorAll(".no-print, .page-edit-btn").forEach(n => n.remove());
  // Use classes — Word honours `page-break-before` on a class reliably, whereas inline
  // styles get normalised to the unsupported `break-before`.
  clone.querySelectorAll(".kfs-page").forEach((p, i) => {
    if (i > 0) p.classList.add("brk");
    if (p.id !== "annexure") p.classList.add("fit");
  });
  // Word/html-docx-js don't reliably apply class-based `border-collapse` cell borders, so
  // force visible borders: the HTML `border` attribute on every top-level (non-nested)
  // table, plus explicit inline borders on the repayment-schedule cells. Browsers/PDF keep
  // using the stylesheet (this only changes the Word/.doc/.docx output).
  clone.querySelectorAll("table.kfs-table:not(.nested)").forEach(t => {
    t.setAttribute("border", "1");
    t.setAttribute("cellspacing", "0");
    t.style.borderCollapse = "collapse";
  });
  clone.querySelectorAll(".schedule td, .schedule th").forEach(c => {
    c.style.border = "1px solid #c9ced6";
  });
  return clone.innerHTML;
}

// Build a complete, self-contained HTML document (Word-compatible) from the rendered
// KFS output, for the .doc / .docx exports.
function buildExportHtml() {
  const body = buildExportBodyHtml();
  if (body === null) return null;
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>Key Facts Statement (KFS)</title>` +
    `<style>${EXPORT_CSS}</style></head><body>${body}</body></html>`;
}

// Show an on-screen A4 print preview as an in-page overlay. A pop-up window is deliberately
// avoided: window.open is silently blocked under file:// and by pop-up blockers. Each section
// is rendered as an A4 sheet on a grey desk with a sticky toolbar to Print / Save-as-PDF or
// close; the @media print rules in styles.css isolate the overlay so only the preview pages
// are printed. Validation is run by the caller before this is invoked.
function printPreview() {
  const body = buildExportBodyHtml();
  if (body === null) return;

  const existing = document.getElementById("pvOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "pvOverlay";
  overlay.className = "pv-overlay";
  overlay.innerHTML =
    `<div class="pv-bar no-print">` +
    `<button type="button" class="pv-print">&#128424; Print / Save as PDF</button>` +
    `<button type="button" class="pv-close">Close</button>` +
    `<span class="pv-hint">A4 portrait &middot; each Annexure on its own page (the repayment schedule may flow across pages)</span>` +
    `</div><div class="pv-pages">${body}</div>`;
  document.body.appendChild(overlay);
  document.body.classList.add("pv-open");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("pv-open");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  overlay.querySelector(".pv-print").addEventListener("click", () => window.print());
  overlay.querySelector(".pv-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
}

// Word 97–2003 (.doc): an HTML document with Office namespaces. Opens natively in
// Microsoft Word / Google Docs and is fully editable.
function generateDocBlob() {
  const html = buildExportHtml();
  if (!html) return null;
  return new Blob(["\ufeff", html], { type: "application/msword" });
}

// Modern Word (.docx): true OOXML produced by html-docx-js from the same HTML.
function generateDocxBlob() {
  const html = buildExportHtml();
  if (!html) return null;
  if (typeof window.htmlDocx === "undefined" || !window.htmlDocx.asBlob) {
    alert("The Word (.docx) library could not be loaded.\nPlease check your internet connection and refresh — or choose PDF or .doc instead.");
    return null;
  }
  try {
    return window.htmlDocx.asBlob(html, { orientation: "portrait", margins: { top: 720, right: 720, bottom: 720, left: 720 } });
  } catch (err) {
    alert("Could not create the Word (.docx) file.\n" + err);
    return null;
  }
}

// Supported export formats keyed by the value the chooser returns.
const EXPORT_TYPES = {
  pdf: { ext: "pdf", mime: "application/pdf", make: generatePdfBlob },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", make: generateDocxBlob },
  doc: { ext: "doc", mime: "application/msword", make: generateDocBlob },
};

// Build a sensible file name for an export of the given extension, from the loan
// proposal / account number (KFS_{account}.{ext}, or KFS_all_loans.{ext} in bulk mode).
function exportFileName(ext) {
  const slug = (s) => String(s || "").trim().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  if (bulkMode) return `KFS_all_loans.${ext}`;
  const acct = slug(document.getElementById("proposalNo") && document.getElementById("proposalNo").value);
  return `${["KFS", acct].filter(Boolean).join("_")}.${ext}`;
}

// Show a small popup letting the user pick the export format. Resolves to
// "pdf" | "docx" | "doc", or null if the user dismisses it.
function chooseExportFormat(actionVerb) {
  return new Promise((resolve) => {
    let overlay = document.getElementById("exportOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "exportOverlay";
      overlay.className = "help-overlay no-print hidden";
      overlay.innerHTML =
        `<div class="help-modal export-modal" role="dialog" aria-modal="true">` +
        `<button type="button" class="help-close" aria-label="Close">&times;</button>` +
        `<h3 class="help-modal-title"></h3>` +
        `<p class="export-modal-sub">Choose a file format:</p>` +
        `<div class="export-format-btns">` +
        `<button type="button" class="export-fmt" data-fmt="pdf">PDF<span>.pdf</span></button>` +
        `<button type="button" class="export-fmt" data-fmt="docx">Word<span>.docx</span></button>` +
        `<button type="button" class="export-fmt" data-fmt="doc">Word 97&ndash;2003<span>.doc</span></button>` +
        `</div></div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector(".help-modal-title").textContent = `${actionVerb} the KFS`;

    const close = (val) => {
      overlay.classList.add("hidden");
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      btns.forEach(b => b.removeEventListener("click", onBtn));
      closeBtn.removeEventListener("click", onClose);
      resolve(val);
    };
    const onOverlay = (e) => { if (e.target === overlay) close(null); };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    const onBtn = (e) => close(e.currentTarget.getAttribute("data-fmt"));
    const onClose = () => close(null);
    const btns = [...overlay.querySelectorAll(".export-fmt")];
    const closeBtn = overlay.querySelector(".help-close");
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);
    btns.forEach(b => b.addEventListener("click", onBtn));
    closeBtn.addEventListener("click", onClose);
    overlay.classList.remove("hidden");
  });
}

// Download the KFS to the user's device in the chosen format (PDF / .docx / .doc).
async function downloadPdf() {
  const fmt = await chooseExportFormat("Download");
  if (!fmt) return;
  const t = EXPORT_TYPES[fmt];
  await withBusy("btnDownload", async () => {
    const blob = await t.make();
    if (blob) downloadBlob(exportFileName(t.ext), blob, t.mime);
  });
}

// Share the KFS in the chosen format via the Web Share API, falling back to a normal
// download when file-sharing isn't supported.
async function sharePdf() {
  const fmt = await chooseExportFormat("Share");
  if (!fmt) return;
  const t = EXPORT_TYPES[fmt];
  await withBusy("btnShare", async () => {
    const blob = await t.make();
    if (!blob) return;
    const filename = exportFileName(t.ext);
    const file = new File([blob], filename, { type: t.mime });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Key Fact Statement (KFS)", text: "Key Fact Statement" });
      } else {
        downloadBlob(filename, blob, t.mime);
        alert("Sharing files isn't supported on this device/browser, so the file was downloaded instead.\nYou can attach it manually to email or any messaging app.");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user dismissed the share sheet
      alert("Could not share the file.\n" + err);
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
    sanctionDate: "2026-05-01",
    disbursalDate: "2026-05-08",
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
    sanctionDate: "2026-04-15",
    disbursalDate: "2026-04-20",
    tenureMonths: "78",
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
    setOutputButtons();
    printBtn.title = `Download / Print the KFS for all ${valid.length} loan(s)`;
  } else {
    bulkMode = false;
    setOutputButtons();
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
      setOutputButtons();
      toggleRateMode();
      toggleCombos();
      toggleMoratoriumInstalment();
      saveInputs();
      refresh();
    };
    el.addEventListener("input", onEdit);
    el.addEventListener("change", onEdit);
  });

  // Date of Sanction mirrors the Date of Disbursement by default, until the user edits
  // it themselves. (Standard ordering: sanction on/before disbursement.)
  const sanctionEl = document.getElementById("sanctionDate");
  const disbursalEl = document.getElementById("disbursalDate");
  if (sanctionEl && disbursalEl) {
    // After restore: if the saved sanction date differs from disbursement, the user had
    // already taken manual control, so stop mirroring.
    if (sanctionEl.value && sanctionEl.value !== disbursalEl.value) sanctionDateAuto = false;
    // Otherwise keep them equal on load.
    if (sanctionDateAuto) sanctionEl.value = disbursalEl.value;
    // The user typing a sanction date decouples it from the disbursement date.
    // Keep sanction ≤ disbursement: if the new sanction date is later than the
    // disbursement date (including when disbursement is still blank), set the
    // disbursement date equal to the sanction date.
    ["input", "change"].forEach(ev => sanctionEl.addEventListener(ev, () => {
      sanctionDateAuto = false;
      if (sanctionEl.value && sanctionEl.value > disbursalEl.value) {
        disbursalEl.value = sanctionEl.value;
        saveInputs();
        refresh();
      }
    }));
    // While still mirroring, changing the disbursement date updates the sanction date too.
    ["input", "change"].forEach(ev => disbursalEl.addEventListener(ev, () => {
      if (sanctionDateAuto) { sanctionEl.value = disbursalEl.value; saveInputs(); refresh(); }
    }));
  }

  // Selecting a Type of Loan auto-fills indicative product defaults (RBI/bank norms).
  const loanTypeSel = document.getElementById("loanType");
  if (loanTypeSel) {
    loanTypeSel.addEventListener("change", () => {
      applyLoanTypeProfile(loanTypeSel.value);
      formatAmount();
      toggleRateMode();
      toggleCombos();
      toggleMoratoriumInstalment();
      setOutputButtons();
      saveInputs();
      refresh();
    });
  }
  const resetBtn = document.getElementById("btnReset");
  if (resetBtn) resetBtn.addEventListener("click", resetToDefaults);
  const resetCardBtn = document.getElementById("btnResetCard");
  if (resetCardBtn) resetCardBtn.addEventListener("click", resetToDefaults);
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
    // Validate at click time: never print with missing/invalid mandatory data.
    if (!validateForm()) {
      alert("Please complete the form first before printing.\nThe missing or invalid fields are highlighted in red and listed at the top — fix them, then try again.");
      return;
    }
    window.print();
  });

  const downloadBtn = document.getElementById("btnDownload");
  if (downloadBtn) downloadBtn.addEventListener("click", () => {
    if (!bulkMode && !validateForm()) {
      alert("Please complete the form first before downloading.\nThe missing or invalid fields are highlighted in red and listed at the top — fix them, then try again.");
      return;
    }
    downloadPdf();
  });

  const previewBtn = document.getElementById("btnPreview");
  if (previewBtn) previewBtn.addEventListener("click", () => {
    if (!bulkMode && !validateForm()) {
      alert("Please complete the form first before previewing.\nThe missing or invalid fields are highlighted in red and listed at the top — fix them, then try again.");
      return;
    }
    printPreview();
  });

  const shareBtn = document.getElementById("btnShare");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    if (!bulkMode && !validateForm()) {
      alert("Please complete the form first before sharing.\nThe missing or invalid fields are highlighted in red and listed at the top — fix them, then try again.");
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
  toggleMoratoriumInstalment();
  refresh();
});
