import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/roles";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { tenantId, role } = await requireTenant();
  if (!canManageIntegrations(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const integration = await prisma.aggregatorIntegration.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.aggregatorIntegration.update({
    where: { id: integration.id },
    data: { webhookSecret: randomBytes(24).toString("hex") },
  });
  return NextResponse.json({ ok: true, webhookSecret: updated.webhookSecret });
}
