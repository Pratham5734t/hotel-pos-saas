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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canTakeOrders(role) && role !== "KITCHEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const order = await prisma.order.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "PAID") data.closedAt = new Date();
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data });
    if (parsed.data.status === "PAID") {
      await tx.payment.create({
        data: {
          orderId: order.id,
          mode: parsed.data.paymentMode ?? "CASH",
          amount: order.total,
        },
      });
    }
  });

  publish(tenantId, "orders", "order:update", { id: order.id, number: order.number });
  publish(tenantId, "kot", "kot:update", { id: order.id, number: order.number });

  // Push status to aggregator if it's an aggregator order and going through lifecycle
  if (
    parsed.data.status &&
    (order.channel === "ZOMATO" || order.channel === "SWIGGY" || order.channel === "MOCK")
  ) {
    const integration = await prisma.aggregatorIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: order.channel } },
    });
    const provider = getProvider(order.channel);
    if (provider && integration && order.externalId) {
      const map: Record<string, "ACCEPTED" | "FOOD_READY" | "DISPATCHED" | "DELIVERED" | "REJECTED"> = {
        KOT_SENT: "ACCEPTED",
        READY: "FOOD_READY",
        SERVED: "DELIVERED",
        PAID: "DELIVERED",
        VOID: "REJECTED",
      };
      const status = map[parsed.data.status];
      if (status) {
        const cfg = integration.config ? JSON.parse(integration.config) : {};
        const result = await provider.pushStatus({
          externalId: order.externalId,
          status,
          config: cfg,
        });
        await prisma.integrationEvent.create({
          data: {
            tenantId,
            provider: order.channel,
            direction: "OUT",
            kind: "STATUS_PUSH",
            externalId: order.externalId,
            payload: JSON.stringify({ status, orderId: order.id }),
            ok: result.ok,
            message: result.message,
          },
        });
        publish(tenantId, "integration", "event", {
          provider: order.channel,
          status,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
