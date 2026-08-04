import type {
  MetadataRoute,
} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HOO",
    short_name: "HOO",
    description:
      "일정, 투두, 집중 기록과 AI 브리핑을 함께 관리하는 HOO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#102f24",
    theme_color: "#102f24",
    lang: "ko-KR",
    categories: [
      "productivity",
      "lifestyle",
      "utilities",
    ],
    icons: [
      {
        src: "/icons/hoo-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hoo-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hoo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}