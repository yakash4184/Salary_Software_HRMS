import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
export const metadata = {
    title: "Savitri Balika Salary Management",
    description: "Salary management system for Savitri Balika Inter College.",
    icons: {
        icon: "/school-logo.png",
        shortcut: "/school-logo.png",
        apple: "/school-logo.png"
    }
};
export default function RootLayout({ children }) {
    return (<html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>);
}
