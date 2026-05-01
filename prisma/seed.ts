import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const SLUG = "grand-demo-hotel";

async function main() {
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Demo tenant '${SLUG}' already exists; skipping seed.`);
    return;
  }

  console.log("Seeding Grand Demo Hotel…");

  const tenant = await prisma.tenant.create({
    data: {
      slug: SLUG,
      name: "Grand Demo Hotel",
      type: "RESTAURANT",
      modules: JSON.stringify({
        restaurant: true,
        bar: true,
        banquet: false,
        lodging: false,
      }),
      gstin: "27ABCDE1234F1Z5",
      address: "MG Road, Pune, Maharashtra",
    },
  });

  const ownerHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.createMany({
    data: [
      {
        tenantId: tenant.id,
        email: "owner@granddemohotel.com",
        name: "Demo Owner",
        password: ownerHash,
        role: "OWNER",
      },
      {
        tenantId: tenant.id,
        email: "cashier@granddemohotel.com",
        name: "Demo Cashier",
        password: await bcrypt.hash("demo1234", 10),
        role: "CASHIER",
      },
      {
        tenantId: tenant.id,
        email: "kitchen@granddemohotel.com",
        name: "Demo Kitchen",
        password: await bcrypt.hash("demo1234", 10),
        role: "KITCHEN",
      },
    ],
  });

  // Outlet
  const outlet = await prisma.outlet.create({
    data: { tenantId: tenant.id, name: "Main Restaurant", kind: "RESTAURANT" },
  });

  // Tables
  const tables = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"].map((label) => ({
    tenantId: tenant.id,
    outletId: outlet.id,
    label,
    seats: 4,
  }));
  await prisma.diningTable.createMany({ data: tables });

  // Menu
  const categories = [
    { name: "Starters", sortOrder: 1 },
    { name: "Main Course", sortOrder: 2 },
    { name: "Indian Breads", sortOrder: 3 },
    { name: "Rice & Biryani", sortOrder: 4 },
    { name: "Desserts", sortOrder: 5 },
    { name: "Beverages", sortOrder: 6 },
  ];
  const cats: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.menuCategory.create({
      data: { tenantId: tenant.id, name: c.name, sortOrder: c.sortOrder },
    });
    cats[c.name] = cat.id;
  }

  const items: Array<{
    cat: string;
    name: string;
    price: number;
    veg: boolean;
    tax?: number;
  }> = [
    { cat: "Starters", name: "Veg Spring Roll", price: 180, veg: true },
    { cat: "Starters", name: "Paneer Tikka", price: 280, veg: true },
    { cat: "Starters", name: "Chicken 65", price: 320, veg: false },
    { cat: "Starters", name: "Honey Chilli Potato", price: 220, veg: true },
    { cat: "Starters", name: "Mutton Seekh Kebab", price: 360, veg: false },
    { cat: "Main Course", name: "Paneer Butter Masala", price: 320, veg: true },
    { cat: "Main Course", name: "Dal Makhani", price: 240, veg: true },
    { cat: "Main Course", name: "Butter Chicken", price: 420, veg: false },
    { cat: "Main Course", name: "Mutton Rogan Josh", price: 480, veg: false },
    { cat: "Main Course", name: "Veg Kolhapuri", price: 280, veg: true },
    { cat: "Indian Breads", name: "Butter Naan", price: 60, veg: true, tax: 5 },
    { cat: "Indian Breads", name: "Garlic Naan", price: 80, veg: true, tax: 5 },
    { cat: "Indian Breads", name: "Tandoori Roti", price: 35, veg: true, tax: 5 },
    { cat: "Indian Breads", name: "Lachha Paratha", price: 60, veg: true, tax: 5 },
    { cat: "Rice & Biryani", name: "Veg Biryani", price: 280, veg: true },
    { cat: "Rice & Biryani", name: "Chicken Biryani", price: 360, veg: false },
    { cat: "Rice & Biryani", name: "Hyderabadi Mutton Biryani", price: 460, veg: false },
    { cat: "Rice & Biryani", name: "Jeera Rice", price: 180, veg: true, tax: 5 },
    { cat: "Desserts", name: "Gulab Jamun (2 pc)", price: 120, veg: true, tax: 5 },
    { cat: "Desserts", name: "Rasmalai (2 pc)", price: 160, veg: true, tax: 5 },
    { cat: "Desserts", name: "Sizzling Brownie", price: 220, veg: true, tax: 5 },
    { cat: "Beverages", name: "Masala Chai", price: 60, veg: true, tax: 5 },
    { cat: "Beverages", name: "Fresh Lime Soda", price: 80, veg: true, tax: 5 },
    { cat: "Beverages", name: "Cold Coffee", price: 140, veg: true, tax: 18 },
    { cat: "Beverages", name: "Lassi (Sweet)", price: 100, veg: true, tax: 5 },
    { cat: "Beverages", name: "Mango Mocktail", price: 160, veg: true, tax: 18 },
  ];

  for (const it of items) {
    await prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        categoryId: cats[it.cat],
        name: it.name,
        price: it.price,
        taxRate: it.tax ?? 5,
        isVeg: it.veg,
      },
    });
  }

  // Aggregator integrations — pre-create all three so the Integrations page is populated
  const providers: Array<"ZOMATO" | "SWIGGY" | "MOCK"> = ["MOCK", "ZOMATO", "SWIGGY"];
  for (const p of providers) {
    await prisma.aggregatorIntegration.create({
      data: {
        tenantId: tenant.id,
        provider: p,
        enabled: p === "MOCK",
        webhookSecret: randomBytes(24).toString("hex"),
        config: "{}",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login as:");
  console.log("  Owner   →  owner@granddemohotel.com / demo1234");
  console.log("  Cashier →  cashier@granddemohotel.com / demo1234");
  console.log("  Kitchen →  kitchen@granddemohotel.com / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
