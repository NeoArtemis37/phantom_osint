import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Phantom Cases — OSINT Investigation Platform",
  description: "Advanced OSINT case management and graph visualization platform for intelligence analysts. Built with Next.js, Cytoscape.js, and TypeScript.",
  keywords: ["OSINT", "investigation", "graph visualization", "case management", "intelligence", "Cytoscape"],
  authors: [{ name: "Phantom Cases Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Phantom Cases",
    description: "OSINT Investigation & Graph Analysis Platform",
    url: "https://chat.z.ai",
    siteName: "Phantom Cases",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Phantom Cases",
    description: "OSINT Investigation & Graph Analysis Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
