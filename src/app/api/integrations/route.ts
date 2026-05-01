import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantApi } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/roles";
import { getProvider } from "@/lib/integrations/registry";

const Body = z.object({ provider: z.enum(["ZOMATO", "SWIGGY", "MOCK"]) });

export async function POST(req: Request) {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId, role } = auth;
  if (!canManageIntegrations(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (!getProvider(parsed.data.provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const created = await prisma.aggregatorIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: parsed.data.provider } },
    update: {},
    create: {
      tenantId,
      provider: parsed.data.provider,
      enabled: true,
      webhookSecret: randomBytes(24).toString("hex"),
      config: "{}",
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
