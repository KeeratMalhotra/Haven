import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/?error=OAuthPermissionDenied",
  },
  callbacks: {
    async signIn({ account }) {
      // Reject sign-in if user denied permissions (no access token granted)
      if (!account?.access_token) {
        return false;
      }

      // Verify that all mandatory scopes were granted by the user.
      // Google's granular consent always provides an access_token even if scopes
      // are unchecked, so we must explicitly check the granted scopes.
      const MANDATORY_SCOPES = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive.file",
      ];

      const grantedScopes = (account.scope ?? "").split(" ").filter(Boolean);
      const missingScopes = MANDATORY_SCOPES.filter(
        (scope) => !grantedScopes.includes(scope)
      );

      if (missingScopes.length > 0) {
        // User denied one or more mandatory permissions - reject sign-in
        return false;
      }

      return true;
    },
    async jwt({ token, account }) {
      // Persist the Google OAuth access token on initial sign-in
      if (account) {
        if (!account.access_token) {
          throw new Error("Missing access token - user denied permissions");
        }
        token.accessToken = account.access_token;
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
