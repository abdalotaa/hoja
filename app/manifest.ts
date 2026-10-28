import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hoja",
    short_name: "Hoja",
    description: "Notas sobre un lienzo, con dictado por voz y IA.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe7",
    theme_color: "#17140f",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
