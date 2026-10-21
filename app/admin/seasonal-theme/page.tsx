import HooHalloweenAdminPanel from "@/components/site-theme/HooHalloweenAdminPanel";

export const metadata = {
  title: "할로윈 사이트 테마 | HOO 관리자",
  robots: { index: false, follow: false },
};

export default function SeasonalThemeAdminPage() {
  return <HooHalloweenAdminPanel />;
}
