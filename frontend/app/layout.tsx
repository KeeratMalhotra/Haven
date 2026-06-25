import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChronAI - Your AI Productivity Companion",
  description:
    "An AI-powered productivity companion with a living particle UI entity that manages your calendar, tasks, and schedule.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-900 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
