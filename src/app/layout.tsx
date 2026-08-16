import type { Metadata } from "next";
import { AdminToggle } from "@/components/admin-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Designer AI",
  description: "Autonomous Website Reverse Engineering Agent",
  keywords: [
    "AI",
    "reverse engineering",
    "web design",
    "code generation",
    "autonomous agent",
  ],
  authors: [{ name: "Code Designer AI" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground flex flex-col">
        {children}
        <AdminToggle />
      </body>
    </html>
  );
}
