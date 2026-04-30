import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { KOTBoard } from "@/components/kot-board";

export const dynamic = "force-dynamic";

export default async function KOTPage() {
  const { tenantId } = await requireTenant();
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ["KOT_SENT", "READY"] },
    },
    include: { items: true, table: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <KOTBoard
      orders={orders.map((o) => ({
        id: o.id,
        number: o.number,
        channel: o.channel,
        status: o.status,
        tableLabel: o.table?.label ?? null,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((it) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          note: it.note,
        })),
      }))}
    />
  );
}
