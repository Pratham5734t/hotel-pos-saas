import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { POSClient } from "@/components/pos-client";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const { tenantId } = await requireTenant();
  const [categories, items, tables] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId, available: true },
      orderBy: { name: "asc" },
    }),
    prisma.diningTable.findMany({
      where: { tenantId },
      orderBy: { label: "asc" },
    }),
  ]);

  return (
    <POSClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        price: i.price,
        taxRate: i.taxRate,
        isVeg: i.isVeg,
      }))}
      tables={tables.map((t) => ({ id: t.id, label: t.label, status: t.status }))}
    />
  );
}
