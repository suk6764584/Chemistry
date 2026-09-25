import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, Home, Inbox, Search } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useItems } from "@/lib/query";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "홈", icon: Home },
  { to: "/inbox", label: "수신함", icon: Inbox },
  { to: "/search", label: "검색", icon: Search },
  { to: "/completed", label: "완료", icon: Archive },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useItems(Boolean(user));
  const inboxCount = items.data?.filter((i) => i.status === "inbox").length ?? 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-sm bg-accent text-accent-fg">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
              <rect x="4" y="6" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 12h8M13 9.5 16 12l-3 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">ActionBox</span>
        </Link>
        <div className="flex min-h-8 items-center">
          {isPending ? (
            <div className="size-8 animate-pulse rounded-full bg-surface-2" />
          ) : user ? (
            <div className="max-w-[11rem] truncate text-sm [&_span]:max-w-[7rem] [&_span]:truncate">
              <UserButton />
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-accent"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
                {item.to === "/inbox" && inboxCount > 0 ? (
                  <span className="absolute top-1.5 right-[calc(50%-1.4rem)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-fg tabular-nums">
                    {inboxCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
