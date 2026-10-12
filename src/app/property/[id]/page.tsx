import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getRepo } from "@/lib/db";
import { courtLinks, listingLinks } from "@/lib/court-links";
import PropertyCard from "@/components/PropertyCard";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property) notFound();
  const [liens, notes] = await Promise.all([repo.listLiens(id), repo.listNotes(id)]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const appUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <PropertyCard
      property={property}
      liens={liens}
      notes={notes}
      courtLinks={courtLinks(property, appUrl)}
      listingLinks={listingLinks(property)}
      streetViewKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? ""}
    />
  );
}
