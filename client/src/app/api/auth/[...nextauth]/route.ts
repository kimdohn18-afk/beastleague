import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';

const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name ?? user.email,
            provider: account.provider,
            providerId: account.providerAccountId,
          }),
        });
      } catch {
        // 서버 연결 실패해도 로그인은 허용
      }
      return true;
    },

    async jwt({ token, account, user }) {
      if (account && user?.email) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/register`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: user.email,
                name: user.name ?? user.email,
                provider: account.provider,
                providerId: account.providerAccountId,
              }),
            }
          );
          if (res.ok) {
            const data = await res.json() as { userId: string; accessToken: string };
            token.userId = data.userId;
            token.accessToken = data.accessToken;
          }
        } catch { /* ignore */ }
        token.provider = account.provider;
        token.providerId = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) session.user.userId = token.userId;
      if (token.accessToken) session.accessToken = token.accessToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
