import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Utensils, Hotel, Webhook, Receipt, BarChart3, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Utensils className="h-6 w-6 text-primary" />
            <span>Hotel POS</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Create your hotel</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="container py-24">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold tracking-tight">
            One POS for your hotel —{" "}
            <span className="text-primary">restaurant, room service, online orders.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Sign up, pick the modules you need, and start taking orders in minutes.
            Built-in adapters for Zomato, Swiggy, and direct online ordering — with a
            mock simulator so you can demo the full flow today.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/signup">
              <Button size="lg">Get started — it&apos;s free</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                I have an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container pb-24 grid gap-6 md:grid-cols-3">
        {[
          {
            icon: Utensils,
            title: "Restaurant POS",
            body: "Touch-first order entry, KOT screen, table management, GST-correct billing, multi-payment.",
          },
          {
            icon: Webhook,
            title: "Aggregators",
            body: "Zomato, Swiggy & direct-online orders flow into the same KOT. Mock simulator built-in.",
          },
          {
            icon: Hotel,
            title: "Universal & multi-tenant",
            body: "Each hotel signs up, picks modules (restaurant, bar, banquet, lodging), and gets isolated data.",
          },
          {
            icon: Receipt,
            title: "Invoices & GST",
            body: "Per-tenant invoice numbering, HSN, configurable tax rates, printable thermal receipts.",
          },
          {
            icon: BarChart3,
            title: "Reports",
            body: "Daily Z-report, channel split (dine-in vs aggregator vs takeaway), item-wise sales.",
          },
          {
            icon: ShieldCheck,
            title: "Role-based access",
            body: "Owner, Manager, Cashier, Waiter, Kitchen — each with the right screen and permissions.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Hotel POS — open-source, MIT.
      </footer>
    </main>
  );
}
