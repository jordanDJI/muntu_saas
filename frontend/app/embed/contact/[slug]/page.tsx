"use client";
import { use } from "react";
import { EmbedForm } from "../../EmbedForm";

export default function ContactWidget({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <EmbedForm slug={slug} widget="contact" />;
}
