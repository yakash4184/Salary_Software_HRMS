import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("sbi-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();
`;
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }}/>
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>);
}
