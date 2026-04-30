import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

const Body = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().optional(),
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
  const created = await prisma.menuCategory.create({
    data: {
      tenantId,
      name: parsed.data.name.trim(),
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
