import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Michroma, Orbit } from "next/font/google";
import "./globals.css";
import ConditionalNavigation from "@/components/ConditionalNavigation";
import ConditionalMain from "@/components/ConditionalMain";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const michroma = Michroma({
  variable: "--font-michroma",
  subsets: ["latin"],
  weight: "400",
});

const orbit = Orbit({
  variable: "--font-orbit",
  subsets: ["latin"],
  weight: "400",
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
        className={`${geistSans.variable} ${geistMono.variable} ${michroma.variable} ${montserrat.variable} ${orbit.variable} antialiased bg-[#181818] text-white`}
      >
        <ConditionalNavigation />
        <ConditionalMain>
          {children}
        </ConditionalMain>
      </body>
    </html>
  );
}
