import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HomeGuest, HomeSignedIn } from "@/components/home-view";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/use-session";
import { useItems } from "@/lib/query";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));

  return (
    <AppShell>
      {isPending ? (
        <div className="space-y-3 pt-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : user ? (
        items.isError ? (
          <LoadError onRetry={() => void items.refetch()} />
        ) : (
          <HomeSignedIn items={items.data ?? []} loading={items.isPending} />
        )
      ) : (
        <HomeGuest />
      )}
    </AppShell>
  );
}
