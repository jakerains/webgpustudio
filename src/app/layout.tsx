import type { Metadata } from "next";
import { DM_Sans, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import {
  GeistPixelSquare,
  GeistPixelGrid,
  GeistPixelCircle,
  GeistPixelTriangle,
  GeistPixelLine,
} from "geist/font/pixel";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = "https://webgpu.studio";

export const metadata: Metadata = {
  title: "WebGPU.Studio — In-Browser AI",
  description:
    "12 AI tools running entirely in your browser — speech-to-text, chat, background removal, object detection, image segmentation, and more. Powered by WebGPU. No servers, no API keys.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "WebGPU.Studio",
    description:
      "12 AI tools running entirely in your browser. No servers, no API keys, no data leaves your device. Powered by WebGPU.",
    url: siteUrl,
    siteName: "WebGPU.Studio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WebGPU.Studio — AI models running in your browser",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WebGPU.Studio — In-Browser AI",
    description:
      "12 AI tools running entirely in your browser. No servers, no API keys. Powered by WebGPU.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${bricolage.variable} ${jetbrainsMono.variable} ${GeistPixelSquare.variable} ${GeistPixelGrid.variable} ${GeistPixelCircle.variable} ${GeistPixelTriangle.variable} ${GeistPixelLine.variable} antialiased bg-background text-foreground`}
      >
        <Sidebar />
        {/* Main content area offset by sidebar width on desktop, top bar on mobile */}
        <div className="lg:ml-[260px] pt-14 lg:pt-0">
          {children}
        </div>
      </body>
    </html>
  );
}
