import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  
  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user?.password) {
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: unknown }).role
        token.id = user.id
      }
      return token
    },

    async session({ session, token }) {
      // ⚠️ 这里必须用局部变量，不能写成两行「行首为括号」的语句：
      //    (session.user as any).role = (token as any).role
      //    (session.user as any).id   = (token as any).id
      // 生产构建压缩会丢掉换行，把第二行并入第一行成为一次函数调用
      //   → token.role(session.user).id = token.id
      // 运行时抛 JWTSessionError: TypeError: t.role is not a function，
      // 导致登录成功却读不到会话（所有 /admin 与 /api/admin 返回 Unauthorized）。
      // dev 不压缩所以看不出来，只有生产镜像会炸。
      const sessionUser = session.user as
        | { role?: unknown; id?: unknown }
        | undefined
      if (sessionUser) {
        const claims = token as { role?: unknown; id?: unknown }
        sessionUser.role = claims.role
        sessionUser.id = claims.id
      }
      return session
    },
  },

  events: {
    async createUser({ user }) {
      // Initialize quota for new users
      await prisma.quota.create({
        data: {
          userId: user.id!,
          used: 0,
          limit: 2,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    },
  },
})
