import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Showcase } from "@/components/showcase/Showcase";
import { TEST_MODE } from "@/lib/site";

export const metadata: Metadata = {
  title: "3D collect showcase · INNEV8 QR Code Hunt",
  robots: { index: false, follow: false },
};

/** Preview of the 3D collect moment. Test mode only, like the printable QR codes page. */
export default function ShowcasePage() {
  if (!TEST_MODE) notFound();
  return <Showcase />;
}
