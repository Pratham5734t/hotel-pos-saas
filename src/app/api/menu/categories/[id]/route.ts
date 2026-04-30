import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cat = await prisma.menuCategory.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const itemCount = await prisma.menuItem.count({ where: { categoryId: cat.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Move or delete the ${itemCount} items in this category first.` },
      { status: 400 },
    );
  }
  await prisma.menuCategory.delete({ where: { id: cat.id } });
  return NextResponse.json({ ok: true });
}
