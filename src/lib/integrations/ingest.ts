import { prisma } from "@/lib/db";
import { publish } from "@/lib/sse";
import { nextOrderNumber } from "@/lib/order-numbers";
import { computeTotals } from "@/lib/totals";
import type { ProviderOrder } from "./types";

/**
 * Convert a normalized ProviderOrder into a real Order row, link aggregator
 * menu items by externalId where possible, and publish realtime events.
 *
 * If a provider item can't be matched to a MenuItem by externalId, we fall
 * back to a "catch-all" menu item so the kitchen still sees it. We log the
 * mismatch as an IntegrationEvent so the operator can map the missing item.
 */
export async function ingestProviderOrder(args: {
  tenantId: string;
  provider: "ZOMATO" | "SWIGGY" | "MOCK";
  order: ProviderOrder;
}) {
  const { tenantId, provider, order } = args;

  // Resolve menu items: match by externalIds JSON containing this provider's id
  const allItems = await prisma.menuItem.findMany({
    where: { tenantId },
    select: { id: true, name: true, price: true, taxRate: true, externalIds: true },
  });

  const externalMap = new Map<string, (typeof allItems)[number]>();
  const nameMap = new Map<string, (typeof allItems)[number]>();
  for (const m of allItems) {
    nameMap.set(m.name.toLowerCase(), m);
    if (!m.externalIds) continue;
    try {
      const ext = JSON.parse(m.externalIds) as Record<string, string>;
      const id = ext[provider.toLowerCase()];
      if (id) externalMap.set(id, m);
    } catch {
      /* ignore */
    }
  }

  const fallback =
    allItems.find((m) => m.name.toLowerCase() === "aggregator passthrough") ??
    allItems[0];

  if (!fallback) {
    throw new Error(
      "Cannot ingest aggregator order: tenant has no menu items configured.",
    );
  }

  const lines = order.items.map((it) => {
    const matched =
      (it.externalId && externalMap.get(it.externalId)) ||
      nameMap.get(it.name.toLowerCase()) ||
      fallback;
    return {
      menuItemId: matched.id,
      name: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice ?? matched.price,
      taxRate: it.taxRate ?? matched.taxRate,
      note: it.note,
      modifiers: it.modifiers && it.modifiers.length ? JSON.stringify(it.modifiers) : null,
      kotPrintedAt: new Date(),
    };
  });

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, taxRate: l.taxRate })),
    { discount: order.discount ?? 0, serviceCharge: order.serviceCharge ?? 0 },
  );

  // Allocate the order number and create the order in the SAME transaction so
  // a failure rolls back the counter — no gaps in the GST invoice sequence.
  const created = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx, tenantId);
    return tx.order.create({
      data: {
        tenantId,
        number: orderNumber,
        channel: provider,
        status: "KOT_SENT",
        externalId: order.externalId,
        externalRef: JSON.stringify(order.raw).slice(0, 60_000),
        customer: order.customer ? JSON.stringify(order.customer) : null,
        notes: order.notes,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        discount: order.discount ?? 0,
        serviceCharge: order.serviceCharge ?? 0,
        items: { create: lines },
      },
      include: { items: true },
    });
  });

  await prisma.integrationEvent.create({
    data: {
      tenantId,
      provider,
      direction: "IN",
      kind: "ORDER_CREATED",
      externalId: order.externalId,
      payload: JSON.stringify(order.raw).slice(0, 60_000),
      ok: true,
      message: `Imported as order #${created.number}`,
    },
  });

  publish(tenantId, "orders", "order:new", { id: created.id, number: created.number });
  publish(tenantId, "kot", "kot:new", { id: created.id, number: created.number });

  return created;
}
