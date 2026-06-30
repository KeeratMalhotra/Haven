import type { Metadata } from "next";
import {
  Inter,
  JetBrains_Mono,
  Pixelify_Sans,
  VT323,
} from "next/font/google";
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

/* Pixel display face — cozy + readable, used for headings and the wordmark */
const pixel = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/* Terminal pixel face — used for tiny eyebrow labels and HUD text */
const terminal = VT323({
  subsets: ["latin"],
  variable: "--font-terminal",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haven - Your Calm Place to Get Things Done",
  description:
    "Haven is the AI that plans your day, protects your time, and learns your rhythm. Calm in the chaos.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Haven - Your Calm Place to Get Things Done",
    description:
      "Haven is the AI that plans your day, protects your time, and learns your rhythm. Calm in the chaos.",
    type: "website",
    siteName: "Haven",
  },
  twitter: {
    card: "summary_large_image",
    title: "Haven - Your Calm Place to Get Things Done",
    description:
      "Haven is the AI that plans your day, protects your time, and learns your rhythm. Calm in the chaos.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${mono.variable} ${pixel.variable} ${terminal.variable}`}
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] dark:text-[#ece9e4] font-sans antialiased">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
