import type { PrismaClient } from "@prisma/client";

/**
 * Atomically allocate the next per-tenant order number.
 * Uses an upsert + update for SQLite-friendly compatibility.
 */
export async function nextOrderNumber(
  tx: Pick<PrismaClient, "counter">,
  tenantId: string,
): Promise<number> {
  await tx.counter.upsert({
    where: { tenantId_scope: { tenantId, scope: "ORDER" } },
    update: {},
    create: { tenantId, scope: "ORDER", value: 0 },
  });
  const updated = await tx.counter.update({
    where: { tenantId_scope: { tenantId, scope: "ORDER" } },
    data: { value: { increment: 1 } },
  });
  return updated.value;
}
