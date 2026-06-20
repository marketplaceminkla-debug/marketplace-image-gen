import type { Metadata } from "next";
import "./globals.css";
import SplashScreen from "@/components/ui/SplashScreen";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { AuthProvider } from "@/lib/auth";

// Runs before paint to set the theme class, preventing a light/dark flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('ps-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}r.style.colorScheme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "PixelSeller — Bulk Product Image Generator",
  description: "Generate marketplace-ready product covers at scale",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Roboto:wght@400;700&family=Oswald:wght@400;600&family=Playfair+Display:wght@400;700&family=Lato:wght@400;700&family=Raleway:wght@400;600&family=Nunito:wght@400;600&family=Open+Sans:wght@400;600&family=DM+Sans:wght@400;600&family=Space+Grotesk:wght@400;600&family=Bebas+Neue&family=Anton&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "Inter, sans-serif" }}>
        <SplashScreen />
        <ThemeToggle />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
