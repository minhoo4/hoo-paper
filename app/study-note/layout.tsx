import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HOO터디 노트",
  description:
    "HOO 계정과 연동되는 설치형 HOO터디 노트",
  applicationName: "HOO터디 노트",
  manifest: "/study-note.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HOO터디 노트",
    statusBarStyle: "black-translucent",
  },
};

export default function StudyNoteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
