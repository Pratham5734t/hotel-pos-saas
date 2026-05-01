import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { MenuManager } from "@/components/menu-manager";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { tenantId } = await requireTenant();
  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-4">Menu</h1>
      <MenuManager
        categories={categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }))}
        items={items.map((i) => ({
          id: i.id,
          categoryId: i.categoryId,
          name: i.name,
          price: i.price,
          taxRate: i.taxRate,
          isVeg: i.isVeg,
          available: i.available,
        }))}
      />
    </div>
  );
}
