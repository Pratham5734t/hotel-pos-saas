import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantApi } from "@/lib/tenant";
import { canManageMenu } from "@/lib/roles";

const Body = z.object({
  label: z.string().min(1).max(20),
  seats: z.number().int().min(1).max(40).default(2),
});

export async function POST(req: Request) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (!canManageMenu(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const created = await prisma.diningTable.create({
    data: {
      tenantId,
      label: parsed.data.label.trim(),
      seats: parsed.data.seats,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
