const HISTORICAL_FINANCIAL_FIELDS = [
  'ticketType', 'createdAt', 'customerId', 'customerIdNumber', 'grossTotal',
  'totalDeductions', 'finalPayout', 'payoutMethod', 'scrapLines', 'checkNumber', 'status',
] as const;

export function preserveServerFinancialFields(
  merged: Record<string, unknown>,
  server: Record<string, unknown>,
): Record<string, unknown> {
  // Canonical purchases and open legacy scrap can only change through buying commands.
  if (server.buying || (server.ticketType === 'SCRAP_METAL' && server.status === 'PENDING')) return server;
  if (!server.ticketType || !['COMPLETED', 'VOIDED'].includes(String(server.status))) return merged;

  const result = { ...merged };
  for (const field of HISTORICAL_FINANCIAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(server, field)) result[field] = server[field];
    else delete result[field];
  }
  // A stale canonical marker must not turn server-owned legacy history into a new purchase.
  if (!server.buying) delete result.buying;
  return result;
}
