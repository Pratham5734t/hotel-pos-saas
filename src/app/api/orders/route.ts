import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canTakeOrders } from "@/lib/roles";
import { computeTotals } from "@/lib/totals";
import { nextOrderNumber } from "@/lib/order-numbers";
import { publish } from "@/lib/sse";

// Body shape from the client. Note: `unitPrice`, `taxRate` and `name` are
// accepted only for legacy clients; we ignore them and source the canonical
// values from the MenuItem row server-side. This prevents a malicious or
// buggy client from billing menu items at the wrong price.
const Body = z.object({
  channel: z.enum(["DINE_IN", "TAKEAWAY", "ROOM_SERVICE"]),
  tableId: z.string().nullable().optional(),
  action: z.enum(["kot", "bill"]),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "ROOM_CHARGE"]).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        qty: z.number().int().min(1),
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

  // Source price, taxRate and display name from the database; never trust the
  // client. An authenticated cashier could otherwise set unitPrice to 0 and
  // generate a zero-rupee GST invoice.
  const menuIds = Array.from(new Set(items.map((i) => i.menuItemId)));
  const menuItems = await prisma.menuItem.findMany({
    where: { tenantId, id: { in: menuIds } },
    select: { id: true, name: true, price: true, taxRate: true, available: true },
  });
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  for (const it of items) {
    const m = menuMap.get(it.menuItemId);
    if (!m) {
      return NextResponse.json(
        { error: "One or more items don't belong to this tenant." },
        { status: 400 },
      );
    }
    if (!m.available) {
      return NextResponse.json(
        { error: `"${m.name}" is currently unavailable.` },
        { status: 400 },
      );
    }
  }

  const lines = items.map((i) => {
    const m = menuMap.get(i.menuItemId)!;
    return {
      menuItemId: m.id,
      name: m.name,
      qty: i.qty,
      unitPrice: m.price,
      taxRate: m.taxRate,
    };
  });

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, taxRate: l.taxRate })),
    { discount: discount ?? 0, serviceCharge: serviceCharge ?? 0 },
  );

  // Tables only apply to dine-in. If the client sent a stale tableId after
  // switching channel, drop it server-side rather than associating a
  // takeaway/room-service order with a dining table.
  const effectiveTableId = channel === "DINE_IN" ? tableId : null;
  if (effectiveTableId) {
    const t = await prisma.diningTable.findFirst({
      where: { id: effectiveTableId, tenantId },
    });
    if (!t) return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const status = action === "bill" ? "PAID" : "KOT_SENT";
  const closedAt = action === "bill" ? new Date() : null;
  const kotPrintedAt = new Date();

  // Allocate the order number and create the order in the SAME transaction so
  // a failure during create rolls back the counter increment — no gaps in the
  // invoice sequence (which doubles as the GST invoice number).
  const created = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx, tenantId);
    return tx.order.create({
      data: {
        tenantId,
        number,
        channel,
        status,
        tableId: effectiveTableId ?? undefined,
        notes,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        discount: discount ?? 0,
        serviceCharge: serviceCharge ?? 0,
        closedAt,
        items: {
          create: lines.map((l) => ({
            menuItemId: l.menuItemId,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
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
  });

  publish(tenantId, "orders", "order:new", { id: created.id, number: created.number });
  if (action !== "bill") {
    publish(tenantId, "kot", "kot:new", { id: created.id, number: created.number });
  }

  return NextResponse.json({ id: created.id, number: created.number });
}
