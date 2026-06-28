import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChronAI - Your Intelligent Time Companion",
  description:
    "ChronAI brings calm intelligence to your time, tasks, and intentions. Designed for focus, built for flow.",
  openGraph: {
    title: "ChronAI - Your Intelligent Time Companion",
    description:
      "ChronAI brings calm intelligence to your time, tasks, and intentions. Designed for focus, built for flow.",
    type: "website",
    siteName: "ChronAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChronAI - Your Intelligent Time Companion",
    description:
      "ChronAI brings calm intelligence to your time, tasks, and intentions. Designed for focus, built for flow.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans antialiased">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
