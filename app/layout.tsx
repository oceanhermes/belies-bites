import "./style.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "belies.bites — Pre-order Gabin",
  description: "Gabin homemade, dibuat fresh untuk setiap pre-order.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <header>
          <a className="brand" href="/">
            belies<span>.</span>bites
          </a>
          <nav>
            <a href="/#menu">Menu pre-order</a>
            <a href="/?cek=1">Cek pesanan</a>
            <a className="button outline" href="/admin">
              Admin ↗
            </a>
          </nav>
        </header>
        {children}
        <footer>
          <b className="brand">belies.bites</b>
          <span>Dibuat sepenuh hati, dinikmati dalam setiap gigitan.</span>
        </footer>
      </body>
    </html>
  );
}
