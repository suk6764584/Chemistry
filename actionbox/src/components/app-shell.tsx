import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CircleCheck, Home, Inbox, Plus, Search, type LucideIcon } from "lucide-react";
import { useCapture } from "@/components/add-sheet";
import { UserButton } from "@/lib/auth/gates";
import { useSession } from "@/lib/use-session";
import { useItems } from "@/lib/query";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--color-primary)" />
      <path
        d="M6 12.5v3.2a1.8 1.8 0 0 0 1.8 1.8h8.4a1.8 1.8 0 0 0 1.8-1.8v-3.2"
        stroke="#fff"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      <path d="m9 10.2 2.4 2.4L16 8" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppShell({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  const { user, isPending } = useSession();
  const router = useRouter();
  const nav = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4">
          {back ? (
            <button
              type="button"
              aria-label="뒤로"
              onClick={() => (window.history.length > 1 ? router.history.back() : nav({ to: "/" }))}
              className="-ml-2.5 grid size-11 place-items-center rounded-full active:bg-surface-3"
            >
              <ArrowLeft className="size-6" aria-hidden />
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <Logo className="size-7" />
              <span className="text-[17px] font-extrabold tracking-tight">ActionBox</span>
            </Link>
          )}
          <div className="ml-auto flex min-h-10 items-center">
            {isPending ? (
              <div className="size-10 animate-pulse rounded-full bg-surface-3" />
            ) : user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm font-semibold shadow-[var(--shadow-card)]">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">{children}</main>

      <BottomNav signedIn={Boolean(user)} />
    </div>
  );
}

function BottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useItems(signedIn);
  const inboxCount = items.data?.filter((i) => i.status === "inbox").length ?? 0;
  const capture = useCapture();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch">
        <NavItem to="/" icon={Home} label="홈" active={pathname === "/"} />
        <NavItem to="/inbox" icon={Inbox} label="수신함" active={pathname.startsWith("/inbox")} badge={inboxCount} />
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => capture.open()}
            aria-label="새 항목 넣기"
            className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] ring-4 ring-bg transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.4} aria-hidden />
          </button>
          <span className="mt-0.5 text-[11px] font-semibold text-primary">넣기</span>
        </div>
        <NavItem to="/search" icon={Search} label="검색" active={pathname.startsWith("/search")} />
        <NavItem to="/completed" icon={CircleCheck} label="완료" active={pathname.startsWith("/completed")} />
      </div>
    </nav>
  );
}

function NavItem({
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
        "relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
        active ? "text-fg" : "text-subtle",
      )}
    >
      <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
      {label}
      {badge > 0 ? (
        <span className="absolute top-1.5 left-[calc(50%+0.35rem)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] leading-none font-bold text-on-primary tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
