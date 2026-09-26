import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { formatVersionDate, MISSING, missingSiteFields, SITE } from "@/lib/site";

/** Shows a filled operator value, or a visible "not filled in yet" marker. */
export function Blank({ value }: { value: string }) {
  return value ? <>{value}</> : <span className="font-semibold text-danger">[{MISSING}]</span>;
}

/** Document layout for the terms and privacy pages — readable without signing in. */
export function LegalDoc({ title, version, children }: { title: string; version?: string; children: ReactNode }) {
  const router = useRouter();
  const missing = missingSiteFields();
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface">
      <header className="sticky top-0 z-10 bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-13 items-center gap-1 px-2">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
            className="grid size-11 place-items-center rounded-full active:bg-surface-2"
          >
            <ChevronLeft className="size-7" strokeWidth={1.9} aria-hidden />
          </button>
          <span className="text-body font-semibold">{title}</span>
        </div>
      </header>
      <article className="px-5 pt-2 pb-16 text-small leading-relaxed text-fg [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
        <h1 className="text-display font-bold">{title}</h1>
        {version ? <p className="mt-1 text-small text-muted">시행일 {formatVersionDate(version)}</p> : null}
        {missing.length ? (
          <p className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-small text-danger" role="alert">
            아직 입력되지 않은 운영자 정보가 있어요: {missing.join(", ")}. 출시 전에 채워야 하는 항목입니다.
          </p>
        ) : null}
        <div className="mt-6 space-y-7">{children}</div>
        <p className="mt-10 text-small text-muted">
          {SITE.serviceName} · 운영자 <Blank value={SITE.operator} />
          {SITE.representative ? ` · 대표 ${SITE.representative}` : ""}
          {SITE.businessNumber ? ` · 사업자등록번호 ${SITE.businessNumber}` : ""}
          {SITE.address ? ` · ${SITE.address}` : ""}
        </p>
      </article>
    </div>
  );
}

export function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-body font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Key/value blocks instead of a wide table, so nothing scrolls sideways on a phone. */
export function Records({ rows }: { rows: { title: string; fields: [string, ReactNode][] }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.title} className="rounded-md bg-surface-2 px-4 py-3">
          <p className="font-semibold">{r.title}</p>
          <dl className="mt-1.5 space-y-1">
            {r.fields.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-20 shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 flex-1">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Terms · privacy · contact, where people look for them. Privacy is emphasized, as Korean guidance asks. */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <nav aria-label="약관 및 정책" className={className}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-small text-muted">
        <Link to="/terms" className="hit-area">
          이용약관
        </Link>
        <Link to="/privacy" className="hit-area font-bold text-fg">
          개인정보 처리방침
        </Link>
        {SITE.supportEmail ? (
          <a href={`mailto:${SITE.supportEmail}`} className="hit-area">
            문의
          </a>
        ) : null}
      </p>
    </nav>
  );
}
