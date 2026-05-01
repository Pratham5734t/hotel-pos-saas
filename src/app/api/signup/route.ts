import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

  const tenantType =
    data.modules.restaurant && data.modules.lodging
      ? "BOTH"
      : data.modules.lodging
        ? "LODGING"
        : "RESTAURANT";

  const hash = await bcrypt.hash(data.password, 10);

  // Retry loop: handles the rare race where two concurrent signups pick the
  // same slug. On P2002 we suffix and try again, capped at 10 attempts.
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>> | null = null;
  let slug = slugBase;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      tenant = await prisma.tenant.create({
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
              email: data.email.toLowerCase().trim(),
              name: data.ownerName,
              password: hash,
              role: "OWNER",
            },
          },
        },
      });
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = (err.meta?.target as string[] | string | undefined) ?? "";
        const targetStr = Array.isArray(target) ? target.join(",") : target;
        if (targetStr.includes("email")) {
          return NextResponse.json(
            {
              error:
                "An account with this email already exists for this hotel.",
            },
            { status: 409 },
          );
        }
        // Slug collision — suffix and retry.
        slug = `${slugBase}-${attempt + 1}`;
        continue;
      }
      throw err;
    }
  }

  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Could not create your hotel — slug is too contended. Try a more unique hotel name.",
      },
      { status: 409 },
    );
  }

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
