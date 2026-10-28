import type { Metadata } from "next";
import { Archivo, Caveat } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  weight: "variable",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: "600",
});

export const metadata: Metadata = {
  title: "Hoja — notas sobre un lienzo",
  description: "Un note taker para estudiantes, equipos y emprendedores. Tus notas viven como ventanas sobre un lienzo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
