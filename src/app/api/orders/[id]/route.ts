import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canTakeOrders } from "@/lib/roles";
import { publish } from "@/lib/sse";
import { getProvider } from "@/lib/integrations/registry";

const Patch = z.object({
  status: z.enum(["OPEN", "KOT_SENT", "READY", "SERVED", "PAID", "VOID"]).optional(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "ROOM_CHARGE", "AGGREGATOR"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { tenantId } = await requireTenant();
  const order = await prisma.order.findFirst({
    where: { id: params.id, tenantId },
    include: { items: true, payments: true, table: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

// Allowed forward transitions. The lifecycle is:
//   OPEN → KOT_SENT → READY → SERVED → PAID
// VOID is reachable from any non-terminal state. PAID and VOID are terminal.
const ALLOWED: Record<string, ReadonlyArray<string>> = {
  OPEN: ["KOT_SENT", "READY", "SERVED", "PAID", "VOID"],
  KOT_SENT: ["READY", "SERVED", "PAID", "VOID"],
  READY: ["SERVED", "PAID", "VOID"],
  SERVED: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

// Reverse map: which "from" statuses are allowed to transition INTO `to`.
const PREDECESSORS: Record<string, ReadonlyArray<string>> = (() => {
  const out: Record<string, string[]> = {};
  for (const [from, tos] of Object.entries(ALLOWED)) {
    for (const to of tos) {
      (out[to] ??= []).push(from);
    }
  }
  return out;
})();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canTakeOrders(role) && role !== "KITCHEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const next = parsed.data.status;
  const data: Record<string, unknown> = {};
  if (next) {
    data.status = next;
    if (next === "PAID") data.closedAt = new Date();
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  // Single transaction: read the order, then either
  //   (a) atomically transition with a status precondition (updateMany), or
  //   (b) plain update for notes-only PATCHes.
  // Using updateMany with a status filter closes the TOCTOU window: two
  // concurrent PAID requests can both see status=SERVED, but only one will
  // satisfy `WHERE status = 'SERVED'` once the first transaction commits.
  type Result =
    | { kind: "ok"; channel: string; number: number; total: number; externalId: string | null }
    | { kind: "notfound" }
    | { kind: "conflict"; message: string };

  const result = await prisma.$transaction<Result>(async (tx) => {
    const cur = await tx.order.findFirst({ where: { id: params.id, tenantId } });
    if (!cur) return { kind: "notfound" };

    if (next) {
      const predecessors = PREDECESSORS[next] ?? [];
      if (!predecessors.includes(cur.status)) {
        const message =
          cur.status === next
            ? `Order is already ${next}.`
            : `Cannot move order from ${cur.status} to ${next}.`;
        return { kind: "conflict", message };
      }

      const upd = await tx.order.updateMany({
        where: { id: cur.id, tenantId, status: cur.status },
        data,
      });
      if (upd.count === 0) {
        // A concurrent PATCH won the race; reject this one.
        return { kind: "conflict", message: "Order status changed during update; please retry." };
      }

      if (next === "PAID") {
        await tx.payment.create({
          data: {
            orderId: cur.id,
            mode: parsed.data.paymentMode ?? "CASH",
            amount: cur.total,
          },
        });
      }
    } else if (Object.keys(data).length > 0) {
      await tx.order.update({ where: { id: cur.id }, data });
    }

    return {
      kind: "ok",
      channel: cur.channel,
      number: cur.number,
      total: cur.total,
      externalId: cur.externalId,
    };
  });

  if (result.kind === "notfound") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }

  publish(tenantId, "orders", "order:update", { id: params.id, number: result.number });
  publish(tenantId, "kot", "kot:update", { id: params.id, number: result.number });

  // Push status to aggregator if it's an aggregator order and we just changed status.
  if (next && (result.channel === "ZOMATO" || result.channel === "SWIGGY" || result.channel === "MOCK")) {
    const integration = await prisma.aggregatorIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: result.channel } },
    });
    const provider = getProvider(result.channel);
    if (provider && integration && result.externalId) {
      const map: Record<string, "ACCEPTED" | "FOOD_READY" | "DISPATCHED" | "DELIVERED" | "REJECTED"> = {
        KOT_SENT: "ACCEPTED",
        READY: "FOOD_READY",
        SERVED: "DELIVERED",
        PAID: "DELIVERED",
        VOID: "REJECTED",
      };
      const status = map[next];
      if (status) {
        const cfg = integration.config ? JSON.parse(integration.config) : {};
        const pushed = await provider.pushStatus({
          externalId: result.externalId,
          status,
          config: cfg,
        });
        await prisma.integrationEvent.create({
          data: {
            tenantId,
            provider: result.channel,
            direction: "OUT",
            kind: "STATUS_PUSH",
            externalId: result.externalId,
            payload: JSON.stringify({ status, orderId: params.id }),
            ok: pushed.ok,
            message: pushed.message,
          },
        });
        publish(tenantId, "integration", "event", {
          provider: result.channel,
          status,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
