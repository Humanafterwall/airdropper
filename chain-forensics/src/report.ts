import type { AuditLog } from "./audit.js";
import type { RiskAssessment } from "./risk.js";
import type { TraceResult } from "./tracer.js";
import { canonicalJson, sha256Hex } from "./util/hash.js";

export const CORE_VERSION = "0.1.0";

export interface CaseReport {
  caseId: string;
  generatedAt: string;
  generatedBy: string;
  softwareVersion: string;
  subject: TraceResult["origin"];
  direction: TraceResult["direction"];
  incomplete: boolean;
  stats: TraceResult["stats"];
  graph: ReturnType<TraceResult["graph"]["toJSON"]>;
  endpoints: { chain: string; address: string; hop: number; entities: string[] }[];
  risk?: RiskAssessment;
  /** Hash of the last audit entry at report time; ties the report to the audit trail. */
  auditHead: string;
  auditEntries: number;
  methodologyNotes: string[];
  /** SHA-256 over the canonical JSON of every field above. */
  reportSha256: string;
}

const NOTES = [
  "All data was read from public blockchain records via the sources listed per transfer; each HTTP response's SHA-256 is recorded in the audit log.",
  "Transfers with attribution 'proportional' are an analytical allocation of multi-input UTXO transactions, not values recorded on-chain.",
  "Address-to-entity labels are attributions with a stated source and confidence; they do not by themselves identify a natural person.",
  "Identification of account holders at exchanges requires a formal legal request to the service provider.",
];

export function buildCaseReport(args: {
  caseId: string;
  actor: string;
  trace: TraceResult;
  risk?: RiskAssessment;
  audit: AuditLog;
  now?: Date;
}): CaseReport {
  const { trace } = args;
  args.audit.append(args.caseId, args.actor, "report.generate", { subject: trace.origin });
  const body = {
    caseId: args.caseId,
    generatedAt: (args.now ?? new Date()).toISOString(),
    generatedBy: args.actor,
    softwareVersion: CORE_VERSION,
    subject: trace.origin,
    direction: trace.direction,
    incomplete: trace.incomplete,
    stats: trace.stats,
    graph: trace.graph.toJSON(),
    endpoints: trace.endpoints.map((n) => ({
      chain: n.chain,
      address: n.address,
      hop: n.hop,
      entities: n.labels.map((l) => `${l.entity} [${l.category}]`),
    })),
    risk: args.risk,
    auditHead: args.audit.head(),
    auditEntries: args.audit.all().length,
    methodologyNotes: NOTES,
  };
  return { ...body, reportSha256: sha256Hex(canonicalJson(body)) };
}

export function verifyCaseReport(report: CaseReport): boolean {
  const { reportSha256, ...body } = report;
  return sha256Hex(canonicalJson(body)) === reportSha256;
}
