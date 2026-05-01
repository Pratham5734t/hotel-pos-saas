import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantApi } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/roles";

const Patch = z.object({
  enabled: z.boolean().optional(),
  config: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (!canManageIntegrations(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const integration = await prisma.aggregatorIntegration.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (parsed.data.config !== undefined) {
    try {
      JSON.parse(parsed.data.config);
    } catch {
      return NextResponse.json({ error: "config must be valid JSON" }, { status: 400 });
    }
  }
  await prisma.aggregatorIntegration.update({
    where: { id: integration.id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (!canManageIntegrations(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const integration = await prisma.aggregatorIntegration.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.aggregatorIntegration.delete({ where: { id: integration.id } });
  return NextResponse.json({ ok: true });
}
