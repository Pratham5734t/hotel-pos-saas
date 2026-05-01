import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantApi } from "@/lib/tenant";

const Patch = z.object({
  name: z.string().min(2).max(80).optional(),
  gstin: z.string().max(20).optional(),
  address: z.string().max(280).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
