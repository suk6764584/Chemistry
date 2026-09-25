import type { ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, CircleCheck, Home, Inbox, Plus, Search, type LucideIcon } from "lucide-react";
import { useCapture } from "@/components/add-sheet";
import { UserButton } from "@/lib/auth/gates";
import { useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--color-primary)" />
      <path
        d="M6 12.5v3.2a1.8 1.8 0 0 0 1.8 1.8h8.4a1.8 1.8 0 0 0 1.8-1.8v-3.2"
        stroke="var(--color-on-primary)"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="m9 10.2 2.4 2.4L16 8"
        stroke="var(--color-on-primary)"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tab screens: brand bar, content, floating "넣기" button and a plain tab bar.
 * Detail screens (`detail`): back button + optional trailing control, no tab bar —
 * the screen brings its own bottom action bar.
 */
export function AppShell({
  children,
  detail = false,
  trailing,
}: {
  children: ReactNode;
  detail?: boolean;
  trailing?: ReactNode;
}) {
  const { user, isPending } = useSession();
  const router = useRouter();
  const nav = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-13 items-center gap-2 px-4">
          {detail ? (
            <button
              type="button"
              aria-label="뒤로"
              onClick={() => (window.history.length > 1 ? router.history.back() : nav({ to: "/" }))}
              className="-ml-3 grid size-11 place-items-center rounded-full active:bg-surface-3"
            >
              <ChevronLeft className="size-7" strokeWidth={1.9} aria-hidden />
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <Logo className="size-6" />
              <span className="text-body font-bold tracking-tight">ActionBox</span>
            </Link>
          )}
          <div className="ml-auto flex min-h-10 items-center">
            {detail ? (
              trailing
            ) : isPending ? (
              <div className="size-9 animate-pulse rounded-full bg-surface-3" />
            ) : user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="hit-area text-body font-semibold text-primary">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "flex-1 px-4",
          detail ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(10rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>

      {detail ? null : <TabBar signedIn={Boolean(user)} />}
    </div>
  );
}

function TabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useItems(signedIn);
  const inboxCount = items.data?.filter((i) => i.status === "inbox").length ?? 0;
  const capture = useCapture();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-4 pb-4">
        <button
          type="button"
          onClick={() => capture.open()}
          aria-label="새 항목 넣기"
          className="pointer-events-auto inline-flex h-13 items-center gap-1.5 rounded-full bg-primary pr-5 pl-4 text-body font-semibold text-on-primary shadow-float transition-transform active:scale-95"
        >
          <Plus className="size-5" strokeWidth={2.4} aria-hidden />
          넣기
        </button>
      </div>
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          <Tab to="/" icon={Home} label="홈" active={pathname === "/"} />
          <Tab to="/inbox" icon={Inbox} label="수신함" active={pathname.startsWith("/inbox")} badge={inboxCount} />
          <Tab to="/search" icon={Search} label="검색" active={pathname.startsWith("/search")} />
          <Tab to="/completed" icon={CircleCheck} label="완료" active={pathname.startsWith("/completed")} />
        </div>
      </nav>
    </>
  );
}

function Tab({
  to,
  icon: Icon,
  label,
  active,
  badge = 0,
}: {
  to: "/" | "/inbox" | "/search" | "/completed";
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 text-micro font-medium",
        active ? "text-fg" : "text-muted",
      )}
    >
      <Icon className="size-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
      {label}
      {badge > 0 ? (
        <span className="absolute top-2 left-1/2 ml-2 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-micro leading-none font-bold text-on-primary tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
