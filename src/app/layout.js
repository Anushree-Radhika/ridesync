import { Rubik } from "next/font/google";
import "./styles/home.module.css";
import { AuthProvider } from "./context/AuthContext";

const rubik = Rubik({ subsets: ["latin"] });

export const metadata = {
  title: "RideSync",
  description: "your ride,your way",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={rubik.className}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}