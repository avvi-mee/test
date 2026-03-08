import type { Contract, ContractClause } from "@/types/contracts";

// ── Indian number-to-words helper (0 – 9,99,999) ─────────────────────────────

function numberToWords(n: number | undefined): string {
  if (n === undefined || n === null || isNaN(n as number)) return "zero";
  if (n < 0) return "minus " + numberToWords(-n);
  if (n === 0) return "zero";

  // Out-of-range: fall back to formatted currency string
  if (n > 9_99_999) return `₹${n.toLocaleString("en-IN")}`;

  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function below100(num: number): string {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
  }

  function below1000(num: number): string {
    if (num < 100) return below100(num);
    return ones[Math.floor(num / 100)] + " hundred" + (num % 100 !== 0 ? " " + below100(num % 100) : "");
  }

  let rem = n;
  let result = "";

  if (rem >= 1_00_000) {
    result += below100(Math.floor(rem / 1_00_000)) + " lakh ";
    rem = rem % 1_00_000;
  }

  if (rem >= 1_000) {
    result += below100(Math.floor(rem / 1_000)) + " thousand ";
    rem = rem % 1_000;
  }

  if (rem > 0) {
    result += below1000(rem);
  }

  return result.trim();
}

// ── Variable Substitution ─────────────────────────────────────────────────────

/**
 * Replaces `{variableName}` tokens in a clause body with values derived from
 * the contract. Unknown tokens are left intact (not silently blanked).
 */
export function substituteVariables(clauseBody: string, contract: Contract): string {
  const cf = contract.customFields as any;

  // Extract city: last segment after the last comma in partyA.address
  const address = contract.partyA.address ?? "";
  const addrParts = address.split(",");
  const studioCity = addrParts[addrParts.length - 1]?.trim() || "India";

  const map: Record<string, string> = {
    partyBName: contract.partyB.name ?? "",
    studioName: contract.partyA.name ?? "",
    studioCity,

    totalContractValue:
      cf?.totalValue != null
        ? `₹${Number(cf.totalValue).toLocaleString("en-IN")}`
        : "",
    totalFees:
      cf?.totalValue != null
        ? `₹${Number(cf.totalValue).toLocaleString("en-IN")}`
        : "",

    monthlySalary:
      cf?.salary != null
        ? `₹${Number(cf.salary).toLocaleString("en-IN")}`
        : "",
    monthlySalaryWords: numberToWords(cf?.salary),

    designation: cf?.designation ?? "",
    joiningDate: cf?.joiningDate ?? "",

    probationPeriodMonths: String(Math.ceil((cf?.probationDays ?? 90) / 30)),
    noticePeriodDays: String(cf?.noticePeriodDays ?? 30),
    workingHours: String(cf?.workingHoursPerWeek ?? 48),
    annualLeavesDays: String(cf?.leaveEntitlement ?? 21),
    nonCompeteMonths: "6",

    warrantyPeriodMonths: String(Math.ceil((cf?.warrantyPeriodDays ?? 365) / 30)),

    expectedCompletionDate: cf?.completionDate ?? "as per project schedule",
    scope: cf?.deliverables ?? cf?.scopeOfWork ?? "as described in this agreement",
    penaltyPerDelayDay: cf?.penaltyClause ?? "₹500",

    startDate: contract.startDate ?? "TBD",
    agreementStartDate: contract.startDate ?? "TBD",
    endDate: contract.endDate ?? "TBD",
    agreementEndDate: contract.endDate ?? "TBD",

    autoRenewal_text: contract.autoRenew
      ? "shall auto-renew for successive one-year terms"
      : "shall NOT auto-renew",
    renewalNoticeDays: String(contract.renewalNoticeDays ?? 30),

    creditPeriodDays: String(cf?.creditPeriodDays ?? 30),
    paymentTerms: cf?.deliveryTerms ?? "net 30",
    terminationNoticeDays: String(cf?.noticePeriodDays ?? 30),
    penaltyPerDelayPercent: "2",
    deliveryLeadTimeDays: "7",
    supplyItems: cf?.supplyItems ?? "goods as agreed",
  };

  return clauseBody.replace(/\{(\w+)\}/g, (_, k: string) => map[k] ?? `{${k}}`);
}

/**
 * Returns all clauses with `{variableName}` tokens substituted. Used in PDF
 * generation and the sign page display.
 */
export function substituteAllClauses(contract: Contract): ContractClause[] {
  return contract.clauses.map((clause) => ({
    ...clause,
    body: substituteVariables(clause.body, contract),
  }));
}
