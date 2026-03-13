import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { loginSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";

const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsedCredentials.data.email },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await compare(
          parsedCredentials.data.password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
