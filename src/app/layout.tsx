import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ReadLingo",
    template: "%s | ReadLingo",
  },
  description:
    "Read foreign-language EPUB books with AI explanations and spaced repetition review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
