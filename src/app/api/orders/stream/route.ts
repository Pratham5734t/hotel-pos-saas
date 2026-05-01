import { requireTenantApi } from "@/lib/tenant";
import { sseStream } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTenantApi();
  if (!auth.ok) return auth.response;
  const { tenantId } = auth;
  return sseStream(tenantId, "orders");
}
