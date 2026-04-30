import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  price: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(50).optional(),
  isVeg: z.boolean().optional(),
  available: z.boolean().optional(),
  description: z.string().max(280).optional(),
  hsnCode: z.string().max(20).optional(),
  externalIds: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const item = await prisma.menuItem.findFirst({ where: { id: params.id, tenantId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.externalIds) {
    data.externalIds = JSON.stringify(parsed.data.externalIds);
  }
  await prisma.menuItem.update({ where: { id: item.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const item = await prisma.menuItem.findFirst({ where: { id: params.id, tenantId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.menuItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
