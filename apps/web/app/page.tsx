import { AppShell } from "@/components/AppShell";
import { Feed } from "@/components/Feed";

export default function HomePage() {
  return (
    <AppShell>
      <h1 className="sr-only">Nora – Your Personalized Social Feed Powered by Shelby</h1>
      <Feed />
    </AppShell>
  );
}
