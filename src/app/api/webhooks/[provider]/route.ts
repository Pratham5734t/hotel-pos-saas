import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/integrations/registry";
import { ingestProviderOrder } from "@/lib/integrations/ingest";

export const dynamic = "force-dynamic";

/**
 * Generic aggregator webhook receiver.
 *
 *   POST /api/webhooks/{provider}?tenant={slug}
 *
 * Authentication: signature in headers (HMAC-SHA256), OR for the Mock provider,
 * the integration's webhookSecret in the `x-webhook-secret` header.
 */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get("tenant");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing ?tenant=" }, { status: 400 });
  }
  const provider = getProvider(params.provider.toUpperCase());
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 400 });
  }
  const integration = await prisma.aggregatorIntegration.findUnique({
    where: { tenantId_provider: { tenantId: tenant.id, provider: provider.id } },
  });
  if (!integration || !integration.enabled) {
    return NextResponse.json(
      { error: `Integration ${provider.id} not enabled for this tenant` },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  // For Mock provider we use a simple shared-secret header to keep things easy.
  if (provider.id === "MOCK") {
    const sent = req.headers.get("x-webhook-secret");
    if (sent !== integration.webhookSecret) {
      await logEvent(tenant.id, provider.id, "ERROR", null, rawBody, false, "bad secret");
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
  } else {
    const ok = await provider.verifyWebhook(req, rawBody, integration.webhookSecret);
    if (!ok) {
      await logEvent(tenant.id, provider.id, "ERROR", null, rawBody, false, "bad signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logEvent(tenant.id, provider.id, "ERROR", null, rawBody, false, "bad json");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsedOrder;
  try {
    parsedOrder = provider.parseOrder(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse error";
    await logEvent(tenant.id, provider.id, "ERROR", null, rawBody, false, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const order = await ingestProviderOrder({
      tenantId: tenant.id,
      provider: provider.id,
      order: parsedOrder,
    });
    return NextResponse.json({ ok: true, orderId: order.id, number: order.number });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingest error";
    await logEvent(
      tenant.id,
      provider.id,
      "ERROR",
      parsedOrder.externalId,
      rawBody,
      false,
      msg,
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function logEvent(
  tenantId: string,
  provider: string,
  kind: string,
  externalId: string | null,
  payload: string,
  ok: boolean,
  message: string,
) {
  await prisma.integrationEvent.create({
    data: {
      tenantId,
      provider,
      direction: "IN",
      kind,
      externalId,
      payload: payload.slice(0, 10_000),
      ok,
      message,
    },
  });
}
