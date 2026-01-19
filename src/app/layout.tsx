import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Armadillo Safety Products - Management System",
  description: "Comprehensive management software for Armadillo Safety Products",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#181818] text-white`}
      >
        <Navigation />
        <main className="lg:ml-[280px] pt-24 lg:pt-8 p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
