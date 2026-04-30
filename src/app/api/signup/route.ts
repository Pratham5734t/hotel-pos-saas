import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

const Body = z.object({
  hotelName: z.string().min(2).max(80),
  gstin: z.string().optional(),
  address: z.string().optional(),
  modules: z.object({
    restaurant: z.boolean(),
    bar: z.boolean(),
    banquet: z.boolean(),
    lodging: z.boolean(),
  }),
  ownerName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const slugBase = generateSlug(data.hotelName) || "hotel";
  let slug = slugBase;
  let i = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${i++}`;
  }

  const tenantType =
    data.modules.restaurant && data.modules.lodging
      ? "BOTH"
      : data.modules.lodging
        ? "LODGING"
        : "RESTAURANT";

  const hash = await bcrypt.hash(data.password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: data.hotelName,
      type: tenantType,
      modules: JSON.stringify(data.modules),
      gstin: data.gstin,
      address: data.address,
      outlets: {
        create: data.modules.restaurant
          ? [{ name: "Main Kitchen", kind: "RESTAURANT" }]
          : [],
      },
      users: {
        create: {
          email: data.email,
          name: data.ownerName,
          password: hash,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });

  // seed a tiny default menu so the POS isn't empty on first login
  if (data.modules.restaurant) {
    const cat = await prisma.menuCategory.create({
      data: { tenantId: tenant.id, name: "Starters", sortOrder: 1 },
    });
    await prisma.menuItem.createMany({
      data: [
        {
          tenantId: tenant.id,
          categoryId: cat.id,
          name: "Veg Spring Roll",
          price: 180,
          taxRate: 5,
          isVeg: true,
        },
        {
          tenantId: tenant.id,
          categoryId: cat.id,
          name: "Chicken 65",
          price: 280,
          taxRate: 5,
          isVeg: false,
        },
      ],
    });
  }

  return NextResponse.json({ ok: true, tenantSlug: tenant.slug });
}
