import { Playfair_Display, Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "sonner";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "RedVyn — Right Donor. Right Time. Real Lives.",
  description:
    "RedVyn connects patients with eligible blood donors when every minute counts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${montserrat.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                className: "border-border bg-card text-foreground",
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
