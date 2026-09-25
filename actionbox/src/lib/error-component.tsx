import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "예상하지 못한 오류가 생겼어요. 페이지를 새로고침해 주세요.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-title font-semibold">문제가 생겼어요</h1>
      <p className="max-w-md text-small break-words text-muted">{errorMessage(error)}</p>
      <a href="/" className="mt-2 inline-flex h-11 items-center rounded-md bg-surface-2 px-4 text-small font-semibold">
        홈으로
      </a>
    </main>
  );
}
