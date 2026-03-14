import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SearchResults } from "@/components/SearchResults";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </AppShell>
  );
}
