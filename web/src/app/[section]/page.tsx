import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dashboard } from "../../components/dashboard";
import {
  SectionContent,
  sections,
  type Section,
} from "../../components/sections";

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return {
    title: Object.hasOwn(sections, section)
      ? sections[section as Section].title
      : "Page not found",
  };
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  if (section === "dashboard") return <Dashboard />;
  return <SectionContent section={section as Exclude<Section, "dashboard">} />;
}
