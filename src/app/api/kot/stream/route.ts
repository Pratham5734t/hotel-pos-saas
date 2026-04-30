import { requireTenant } from "@/lib/tenant";
import { sseStream } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const { tenantId } = await requireTenant();
  return sseStream(tenantId, "kot");
}
