import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantSlug: { label: "Hotel", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const slug = credentials.tenantSlug?.toLowerCase().trim();
        // If a tenant slug is supplied, do an exact composite-key lookup.
        // Otherwise require email to match exactly ONE user across all tenants —
        // if multiple tenants share the email, the user must disambiguate.
        let user;
        if (slug) {
          const tenant = await prisma.tenant.findUnique({ where: { slug } });
          if (!tenant) return null;
          user = await prisma.user.findUnique({
            where: { tenantId_email: { tenantId: tenant.id, email } },
            include: { tenant: true },
          });
        } else {
          const matches = await prisma.user.findMany({
            where: { email },
            include: { tenant: true },
            take: 2,
          });
          if (matches.length !== 1) return null;
          user = matches[0];
        }
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          tenantName: user.tenant.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.tenantSlug = (user as { tenantSlug: string }).tenantSlug;
        token.tenantName = (user as { tenantName: string }).tenantName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantSlug = token.tenantSlug as string;
        session.user.tenantName = token.tenantName as string;
      }
      return session;
    },
  },
};
