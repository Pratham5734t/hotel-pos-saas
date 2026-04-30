import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

const Body = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  price: z.number().nonnegative(),
  taxRate: z.number().min(0).max(50).default(5),
  categoryId: z.string().min(1),
  isVeg: z.boolean().default(true),
  available: z.boolean().default(true),
  hsnCode: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  const { tenantId, role } = await requireTenant();
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const cat = await prisma.menuCategory.findFirst({
    where: { id: parsed.data.categoryId, tenantId },
  });
  if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 400 });
  const created = await prisma.menuItem.create({
    data: {
      tenantId,
      categoryId: cat.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description,
      price: parsed.data.price,
      taxRate: parsed.data.taxRate,
      isVeg: parsed.data.isVeg,
      available: parsed.data.available,
      hsnCode: parsed.data.hsnCode,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
