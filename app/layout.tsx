import type {
  Metadata,
  Viewport,
} from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";
import "./globals.css";

import PwaRegister from "./PwaRegister";
import PwaInstallButton from "./PwaInstallButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOO",
  description:
    "일정, 투두, 집중 기록과 AI 브리핑을 함께 관리하는 HOO",
  applicationName: "HOO",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "HOO",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/icons/hoo-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/hoo-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#102f24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PwaRegister />
        <PwaInstallButton />
        {children}
      </body>
    </html>
  );
}
