import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import jwt from 'jsonwebtoken';

const handler = NextAuth({
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
      authorization: {
        params: { prompt: 'login' },
      },
      profile(profile: any) {
        const nickname =
          profile?.kakao_account?.profile?.nickname ||
          profile?.properties?.nickname ||
          '카카오유저';
        const email =
          profile?.kakao_account?.email ||
          `kakao_${profile.id}@beastleague.local`;
        return {
          id: String(profile.id),
          name: nickname,
          email,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: { prompt: 'select_account' },
      },
    }),
    CredentialsProvider({
      id: 'dev-login',
      name: 'Dev Login',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
        email: { label: 'Email', type: 'text' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.userId) return null;
        return {
          id: credentials.userId,
          email: credentials.email,
          name: credentials.name,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            provider: account?.provider || 'dev',
            providerId: user.id || account?.providerAccountId,
          }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        (user as any).backendToken = data.token;
        (user as any).userId = data.user._id;
        return true;
      } catch (error) {
        console.error('signIn callback error:', error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.backendToken = (user as any).backendToken;
        token.userId = (user as any).userId;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).backendToken = token.backendToken;
      (session as any).userId = token.userId;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
