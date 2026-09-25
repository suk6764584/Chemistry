import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HomeGuest, HomeSignedIn } from "@/components/home-view";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useItems } from "@/lib/query";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const items = useItems(Boolean(user));

  return (
    <AppShell>
      {isPending ? (
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-2" />
        </div>
      ) : user ? (
        <HomeSignedIn items={items.data ?? []} loading={items.isPending} />
      ) : (
        <HomeGuest />
      )}
    </AppShell>
  );
}
