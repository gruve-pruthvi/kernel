import type { Metadata } from "next";
import { getIdentity } from "@/core/content";

const identity = getIdentity();

export const metadata: Metadata = { title: { absolute: `${identity.name} — ${identity.role}` } };

export default function FrontPage() {
  return (
    <div className="py-14 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{identity.name}</h1>
      <p className="mt-3 text-lg text-muted">{identity.role}</p>
    </div>
  );
}
