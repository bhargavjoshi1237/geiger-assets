import { Geist, Geist_Mono } from "next/font/google";
import { BannerProvider, GlobalBanner } from "@geiger/ui";
import { Toaster } from "@geiger/ui/sonner";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SystemFavicon } from "@/components/system-favicon";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Assets - Geiger Studio",
  description: "Geiger Studio - Assets",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SystemFavicon />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BannerProvider>
            <GlobalBanner />
            <div className="flex flex-col min-h-screen">{children}</div>
            <Toaster />
          </BannerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
