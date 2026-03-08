import type { ContractClause, ContractType } from "@/types/contracts";

interface DefaultClause extends ContractClause {
  id: string; // local only — for dev-time deduplication
}

// ── Client Contract Clauses ────────────────────────────────────────────────────

const CLIENT_CONTRACT_CLAUSES: DefaultClause[] = [
  {
    id: "client_scope",
    order: 1,
    title: "Scope of Work",
    body: "{studioName} agrees to provide interior design and execution services for {partyBName} for the project described herein, covering {scope}. The scope includes design consultation, material selection, and project execution as per the agreed plan. Any changes to the scope must be agreed upon in writing by both parties.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "client_payment",
    order: 2,
    title: "Payment Terms",
    body: "The total contract value is {totalContractValue}. {partyBName} agrees to make payments as per the payment schedule attached hereto. All payments are due within 7 days of the milestone completion. Late payments shall attract interest at {penaltyPerDelayPercent}% per month. GST and other applicable taxes shall be payable additionally.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "client_timeline",
    order: 3,
    title: "Project Timeline",
    body: "The project is expected to commence on {startDate} and shall be completed by {expectedCompletionDate}, subject to timely receipt of payments and client approvals. Delays attributable to the client shall extend the timeline accordingly. A penalty of {penaltyPerDelayDay} per day shall apply for delays caused by {studioName}, excluding force majeure events.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "client_warranty",
    order: 4,
    title: "Warranty",
    body: "{studioName} provides a warranty of {warrantyPeriodMonths} months on workmanship from the date of project handover. This warranty covers defects arising from faulty workmanship but excludes damage caused by misuse, negligence, or normal wear and tear. Warranty claims must be reported in writing within the warranty period.",
    isRequired: false,
    isEditable: true,
  },
  {
    id: "client_ip",
    order: 5,
    title: "Intellectual Property",
    body: "All design concepts, drawings, and creative works developed by {studioName} shall remain the intellectual property of {studioName} until full payment is received. Upon receipt of final payment, {partyBName} shall have a non-exclusive licence to use the designs solely for the project described herein.",
    isRequired: false,
    isEditable: true,
  },
  {
    id: "client_termination",
    order: 6,
    title: "Termination",
    body: "Either party may terminate this agreement by giving {terminationNoticeDays} days written notice. In the event of termination by {partyBName}, all completed work shall be paid for at the applicable rate, and any non-recoverable costs incurred by {studioName} shall be reimbursed. Termination by {studioName} due to non-payment entitles {studioName} to immediate payment for all work completed.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "client_dispute",
    order: 7,
    title: "Dispute Resolution",
    body: "Any dispute arising out of or in connection with this agreement shall first be resolved through mutual negotiation. If unresolved within 30 days, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be {studioCity}, India. The language of arbitration shall be English.",
    isRequired: true,
    isEditable: false,
  },
];

// ── Employee Contract Clauses ──────────────────────────────────────────────────

const EMPLOYEE_CONTRACT_CLAUSES: DefaultClause[] = [
  {
    id: "emp_appointment",
    order: 1,
    title: "Appointment",
    body: "{studioName} (the Company) hereby appoints {partyBName} as {designation} with effect from {joiningDate}. The employment is subject to the terms and conditions set forth in this agreement. {partyBName} agrees to devote full time and attention to the duties assigned and to act in the best interests of the Company.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "emp_probation",
    order: 2,
    title: "Probation Period",
    body: "The first {probationPeriodMonths} months of employment shall be a probationary period, during which the performance and suitability of {partyBName} will be assessed. The Company may extend the probation period or terminate the employment during probation with {noticePeriodDays} days written notice, without assigning any reason.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "emp_compensation",
    order: 3,
    title: "Compensation",
    body: "{partyBName} shall be paid a gross monthly salary of {monthlySalary} (Rupees {monthlySalaryWords} only), subject to applicable tax deductions. The salary shall be disbursed on or before the 5th of each calendar month. The Company may revise the salary annually based on performance and business conditions.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "emp_working_hours",
    order: 4,
    title: "Working Hours & Leave",
    body: "The standard working hours are {workingHours} hours per week. {partyBName} is entitled to {annualLeavesDays} days of paid annual leave per year, in addition to public holidays as declared by the Company. Leave must be applied for in advance and is subject to operational requirements.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "emp_notice",
    order: 5,
    title: "Notice Period",
    body: "After the probation period, either party may terminate this agreement by giving {noticePeriodDays} days written notice or payment in lieu thereof. The Company reserves the right to waive the notice period and make payment in lieu at its sole discretion. Summary dismissal may be effected for gross misconduct.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "emp_confidentiality",
    order: 6,
    title: "Confidentiality",
    body: "{partyBName} shall not, during or after employment, disclose any confidential information, trade secrets, client data, or proprietary information of {studioName} to any third party. This obligation survives the termination of employment indefinitely. Breach of this clause shall entitle the Company to seek injunctive relief and damages.",
    isRequired: true,
    isEditable: false,
  },
  {
    id: "emp_non_compete",
    order: 7,
    title: "Non-Compete",
    body: "For a period of {nonCompeteMonths} months following the termination of employment, {partyBName} shall not, directly or indirectly, solicit clients of {studioName} or engage in a competing business within the jurisdiction of {studioCity}. This restriction applies to all clients {partyBName} interacted with during their employment.",
    isRequired: false,
    isEditable: true,
  },
];

// ── Contractor Clauses ─────────────────────────────────────────────────────────

const CONTRACTOR_CLAUSES: DefaultClause[] = [
  {
    id: "con_engagement",
    order: 1,
    title: "Engagement",
    body: "{studioName} engages {partyBName} as an independent contractor for the period from {agreementStartDate} to {agreementEndDate}. {partyBName} is not an employee of {studioName} and shall not be entitled to employee benefits. {partyBName} shall be responsible for their own taxes and statutory contributions.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "con_fees",
    order: 2,
    title: "Fees & Payment",
    body: "{studioName} shall pay {partyBName} total fees of {totalFees} as per the payment schedule agreed herein. Invoices shall be raised by {partyBName} upon milestone completion and shall be paid within 14 days of approval. All taxes applicable on {partyBName}'s fees shall be the responsibility of {partyBName}.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "con_deliverables",
    order: 3,
    title: "Deliverables",
    body: "{partyBName} agrees to deliver {scope} by {expectedCompletionDate}. All deliverables must meet the quality standards specified by {studioName}. Failure to deliver on time may attract a penalty of {penaltyPerDelayDay} per day of delay. {partyBName} shall not subcontract the work without prior written consent from {studioName}.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "con_termination_c",
    order: 4,
    title: "Termination",
    body: "Either party may terminate this agreement by giving {terminationNoticeDays} days written notice. {studioName} may terminate immediately for cause, including non-performance, breach of contract, or misconduct. Upon termination, {partyBName} shall deliver all completed work and return any materials or equipment provided by {studioName}.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "con_ip_c",
    order: 5,
    title: "Intellectual Property",
    body: "All work product, designs, drawings, and deliverables created by {partyBName} under this agreement shall be considered works made for hire and shall vest exclusively in {studioName} upon full payment. {partyBName} hereby assigns all rights, title, and interest in such works to {studioName}.",
    isRequired: true,
    isEditable: false,
  },
  {
    id: "con_confidentiality_c",
    order: 6,
    title: "Confidentiality",
    body: "{partyBName} shall maintain strict confidentiality regarding all information disclosed by {studioName}, including project details, client information, and proprietary methods. This obligation continues for 2 years after the expiry of this agreement. {partyBName} shall not retain copies of any confidential materials after project completion.",
    isRequired: true,
    isEditable: false,
  },
];

// ── Vendor Clauses ─────────────────────────────────────────────────────────────

const VENDOR_CLAUSES: DefaultClause[] = [
  {
    id: "ven_supply",
    order: 1,
    title: "Supply of Goods / Services",
    body: "{partyBName} agrees to supply {supplyItems} to {studioName} as per the purchase orders raised from time to time during the period {agreementStartDate} to {agreementEndDate}. All supplies must conform to the specifications provided by {studioName}. {studioName} reserves the right to reject non-conforming goods.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "ven_delivery",
    order: 2,
    title: "Delivery Terms",
    body: "{partyBName} shall deliver goods within {deliveryLeadTimeDays} business days of receiving a purchase order unless otherwise agreed in writing. Delivery shall be made to the address specified in the purchase order. Risk of loss transfers to {studioName} upon delivery and acceptance of goods.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "ven_payment_v",
    order: 3,
    title: "Payment Terms",
    body: "{studioName} shall make payment within {creditPeriodDays} days of receiving a valid invoice and accepted delivery. Payment terms are {paymentTerms}. Any disputed invoices must be raised within 7 days of receipt. {partyBName} may charge interest at 1.5% per month on overdue amounts.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "ven_quality",
    order: 4,
    title: "Quality Standards",
    body: "All goods and services supplied shall meet the quality standards specified by {studioName} and applicable industry standards. {partyBName} shall maintain quality control records and make them available for inspection upon request. Defective goods shall be replaced at {partyBName}'s cost within {deliveryLeadTimeDays} days of notification.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "ven_termination_v",
    order: 5,
    title: "Termination",
    body: "Either party may terminate this agreement by giving {terminationNoticeDays} days written notice. {studioName} may terminate immediately if {partyBName} repeatedly fails to meet quality standards, delivery timelines, or payment disputes remain unresolved. All outstanding purchase orders shall be honoured upon termination.",
    isRequired: true,
    isEditable: true,
  },
  {
    id: "ven_renewal_v",
    order: 6,
    title: "Renewal",
    body: "This agreement {autoRenewal_text} upon expiry on {agreementEndDate}. Either party wishing to not renew must give {renewalNoticeDays} days written notice before the expiry date. Renewed terms shall be on the same commercial terms unless renegotiated by mutual written agreement.",
    isRequired: false,
    isEditable: true,
  },
];

// ── Exports ────────────────────────────────────────────────────────────────────

export const DEFAULT_CLAUSES: Record<ContractType, DefaultClause[]> = {
  client: CLIENT_CONTRACT_CLAUSES,
  employee: EMPLOYEE_CONTRACT_CLAUSES,
  contractor: CONTRACTOR_CLAUSES,
  vendor: VENDOR_CLAUSES,
};

/**
 * Returns ContractClause[] (without the dev-time `id` field) with order
 * set to the array index + 1 — ready to drop into Contract.clauses.
 */
export function getDefaultClauses(type: ContractType): ContractClause[] {
  return DEFAULT_CLAUSES[type].map(({ id: _id, ...clause }, index) => ({
    ...clause,
    order: index + 1,
  }));
}
