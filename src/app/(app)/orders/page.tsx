import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { OrdersList } from "@/components/orders-list";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { tenantId } = await requireTenant();

  const channel = (searchParams.channel as string | undefined) ?? undefined;
  const status = (searchParams.status as string | undefined) ?? undefined;

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { table: true, items: { select: { id: true } } },
  });

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Link href="/pos" className="text-sm text-primary hover:underline">
          + New POS order
        </Link>
      </div>
      <OrdersList
        orders={orders.map((o) => ({
          id: o.id,
          number: o.number,
          channel: o.channel,
          status: o.status,
          total: o.total,
          tableLabel: o.table?.label ?? null,
          itemCount: o.items.length,
          createdAt: o.createdAt.toISOString(),
        }))}
        activeChannel={channel ?? null}
        activeStatus={status ?? null}
      />
    </div>
  );
}
