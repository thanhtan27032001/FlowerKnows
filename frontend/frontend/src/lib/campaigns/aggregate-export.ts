import {
  aggregateExportLines,
  exchangedItem,
  plainItem,
} from "@/src/lib/export/aggregate";
import type { ExportCustomerGroup, ExportLineInput } from "@/src/lib/export/types";
import type {
  ParticipantSummary,
  ParticipantToken,
} from "@/src/lib/api/campaign";

export type ParticipantExportSource = {
  participant: ParticipantSummary;
  tokens: ParticipantToken[];
};

function tokenDisplay(token: ParticipantToken) {
  const into = (token.exchangedIntoProductNames ?? []).filter(Boolean);
  if (token.status === "EXCHANGED" && into.length > 0) {
    return exchangedItem(into, token.productName);
  }
  return plainItem(token.productName);
}

/**
 * Aggregate selected campaign participants' tokens into packing-list groups
 * (US-37). Uses the same display rules as US-16 for exchanged tokens.
 */
export function aggregateParticipantsForExport(
  sources: ParticipantExportSource[]
): ExportCustomerGroup[] {
  const lines: ExportLineInput[] = [];
  for (const { participant, tokens } of sources) {
    for (const token of tokens) {
      lines.push({
        customerId: participant.customerId,
        customerName: participant.customerName,
        display: tokenDisplay(token),
      });
    }
  }
  return aggregateExportLines(lines);
}
