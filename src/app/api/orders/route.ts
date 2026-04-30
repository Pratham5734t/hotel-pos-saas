import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canTakeOrders } from "@/lib/roles";
import { computeTotals } from "@/lib/totals";
import { nextOrderNumber } from "@/lib/order-numbers";
import { publish } from "@/lib/sse";

const Body = z.object({
  channel: z.enum(["DINE_IN", "TAKEAWAY", "ROOM_SERVICE"]),
  tableId: z.string().nullable().optional(),
  action: z.enum(["kot", "bill"]),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "ROOM_CHARGE"]).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        name: z.string(),
        qty: z.number().int().min(1),
        unitPrice: z.number().nonnegative(),
        taxRate: z.number().min(0).max(50),
      }),
    )
    .min(1),
  discount: z.number().nonnegative().optional(),
  serviceCharge: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const { tenantId, role } = await requireTenant();
  if (!canTakeOrders(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { items, channel, tableId, action, paymentMode, discount, serviceCharge, notes } =
    parsed.data;

  const totals = computeTotals(
    items.map((i) => ({ unitPrice: i.unitPrice, qty: i.qty, taxRate: i.taxRate })),
    { discount: discount ?? 0, serviceCharge: serviceCharge ?? 0 },
  );

  // verify menu items belong to this tenant
  const menuIds = items.map((i) => i.menuItemId);
  const validIds = await prisma.menuItem.findMany({
    where: { tenantId, id: { in: menuIds } },
    select: { id: true },
  });
  const validSet = new Set(validIds.map((m) => m.id));
  if (validIds.length !== new Set(menuIds).size) {
    return NextResponse.json(
      { error: "One or more items don't belong to this tenant" },
      { status: 400 },
    );
  }
  for (const it of items) {
    if (!validSet.has(it.menuItemId)) {
      return NextResponse.json({ error: "Invalid menu item" }, { status: 400 });
    }
  }

  if (tableId) {
    const t = await prisma.diningTable.findFirst({
      where: { id: tableId, tenantId },
    });
    if (!t) return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const number = await prisma.$transaction((tx) => nextOrderNumber(tx, tenantId));

  const status = action === "bill" ? "PAID" : "KOT_SENT";
  const closedAt = action === "bill" ? new Date() : null;
  const kotPrintedAt = new Date();

  const created = await prisma.order.create({
    data: {
      tenantId,
      number,
      channel,
      status,
      tableId: tableId ?? undefined,
      notes,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      discount: discount ?? 0,
      serviceCharge: serviceCharge ?? 0,
      closedAt,
      items: {
        create: items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          qty: i.qty,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          kotPrintedAt,
        })),
      },
      payments:
        action === "bill"
          ? {
              create: {
                mode: paymentMode ?? "CASH",
                amount: totals.total,
              },
            }
          : undefined,
    },
  });

  publish(tenantId, "orders", "order:new", { id: created.id, number: created.number });
  if (action !== "bill") {
    publish(tenantId, "kot", "kot:new", { id: created.id, number: created.number });
  }

  return NextResponse.json({ id: created.id, number: created.number });
}
