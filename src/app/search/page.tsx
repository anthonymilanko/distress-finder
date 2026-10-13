import { redirect } from "next/navigation";

/** Address search now lives on the map page. Old links/bookmarks land there. */
export default function SearchPage() {
  redirect("/");
}
