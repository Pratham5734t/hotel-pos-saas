import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Page-context auth guard. Redirects to /login on missing session.
 * MUST NOT be called from API Route Handlers — a 307 redirect to /login
 * gets followed transparently by fetch(), which then receives the login
 * page HTML with status 200, breaking JSON parsing in the client.
 * Use {@link requireTenantApi} from API routes instead.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireTenant() {
  const session = await requireSession();
  return {
    session,
    tenantId: session.user.tenantId,
    role: session.user.role,
  };
}

export async function getOptionalSession() {
  return getServerSession(authOptions);
}

/**
 * API-context auth guard. Returns a discriminated union: when `ok` is true,
 * the call site may use `tenantId` / `role` / `session`; when `ok` is false,
 * the call site MUST `return auth.response` (a 401 JSON response).
 *
 * Splitting this from {@link requireTenant} avoids the 307→200 HTML response
 * trap that breaks every client-side `fetch().json()` after the session expires.
 */
export async function requireTenantApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    ok: true as const,
    session,
    tenantId: session.user.tenantId,
    role: session.user.role,
  };
}
