import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ROLES } from "@/lib/roles";

const Body = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES),
});

export async function POST(req: Request) {
  const { tenantId, role } = await requireTenant();
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can invite users" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const exists = await prisma.user.findFirst({
    where: { tenantId, email: parsed.data.email },
  });
  if (exists) {
    return NextResponse.json(
      { error: "A user with this email already exists in your hotel." },
      { status: 400 },
    );
  }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      tenantId,
      name: parsed.data.name,
      email: parsed.data.email,
      password: hash,
      role: parsed.data.role,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
