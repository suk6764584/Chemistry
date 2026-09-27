import type { ReactNode } from "react";
import { Link, Navigate, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, CircleCheck, Home, Inbox, Plus, Search, type LucideIcon } from "lucide-react";
import { useCapture } from "@/components/add-sheet";
import { UserButton } from "@/lib/auth/gates";
import { useAccountStatus, useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

/** 다람 mark: a squirrel holding an acorn (same drawing as the app icons in public/icons). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="24" fill="#f07a2c" />
      <path
        d="M50 86 C74 88 90 72 88 50 C86 32 74 20 62 22 C52 24 50 36 58 41 C66 46 70 54 66 64 C63 71 57 76 50 78 Z"
        fill="#ffe2c2"
      />
      <path d="M30 86 C24 76 25 63 33 56 C40 50 52 51 57 60 C62 70 59 82 52 86 Z" fill="#ffffff" />
      <circle cx="39" cy="43" r="12" fill="#ffffff" />
      <path d="M29.5 40 C24 42 21 45 21.5 48 C22 51 27 52 32 50 Z" fill="#ffffff" />
      <path d="M40 33 L43 20 L49 33 Z" fill="#ffffff" />
      <circle cx="35.5" cy="41" r="2.3" fill="#5a2e12" />
      <circle cx="22.4" cy="47.2" r="1.4" fill="#5a2e12" />
      <path d="M27 63 C27 58.5 30 56 34 56 C38 56 41 58.5 41 63 Z" fill="#8a4a1c" />
      <path d="M28.5 63 H39.5 C39.5 69.5 37 73 34 74.5 C31 73 28.5 69.5 28.5 63 Z" fill="#c8793a" />
      <rect x="33" y="52" width="2" height="5" rx="1" fill="#8a4a1c" />
    </svg>
  );
}

/**
 * Tab screens: brand bar, content, and a tab bar with the "넣기" button in the middle.
 * Detail screens (`detail`): back button + optional trailing control, no tab bar —
 * the screen brings its own bottom action bar.
 * Signed-in people without a current agreement are sent to /agree first
 * (`requireConsent={false}` only for screens reachable from there).
 */
export function AppShell({
  children,
  detail = false,
  trailing,
  requireConsent = true,
}: {
  children: ReactNode;
  detail?: boolean;
  trailing?: ReactNode;
  requireConsent?: boolean;
}) {
  const { user, isPending } = useSession();
  const router = useRouter();
  const nav = useNavigate();
  const account = useAccountStatus(Boolean(user) && requireConsent);

  if (requireConsent && account.data?.needsConsent) return <Navigate to="/agree" />;

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
              <span className="text-body font-bold tracking-tight">다람</span>
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
          detail ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
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
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          <Tab to="/" icon={Home} label="홈" active={pathname === "/"} />
          <Tab to="/inbox" icon={Inbox} label="수신함" active={pathname.startsWith("/inbox")} badge={inboxCount} />
          {/* In the bar rather than floating, so it never covers a row's buttons. */}
          <button
            type="button"
            onClick={() => capture.open()}
            aria-label="새 항목 넣기"
            className="flex flex-col items-center justify-center gap-1 text-micro font-semibold text-primary"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary text-on-primary shadow-float transition-transform active:scale-95">
              <Plus className="size-5" strokeWidth={2.4} aria-hidden />
            </span>
            넣기
          </button>
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

