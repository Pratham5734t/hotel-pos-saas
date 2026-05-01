import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantApi } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const t = await prisma.diningTable.findFirst({ where: { id: params.id, tenantId } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.diningTable.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
}
