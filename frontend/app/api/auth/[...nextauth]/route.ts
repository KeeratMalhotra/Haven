import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, account }) {
      // Persist the Google OAuth access token on initial sign-in
      if (account) {
        // Handle case where user denies permissions - access_token may be null/undefined
        token.accessToken = account.access_token ?? "";
        token.refreshToken = account.refresh_token ?? "";
        token.expiresAt = account.expires_at ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      // Expose the access token to the client session (empty string if missing)
      const sessionWithToken = session as unknown as Record<string, unknown>;
      sessionWithToken.accessToken = token.accessToken ?? "";
      return session;
    },
  },
});

export { handler as GET, handler as POST };
