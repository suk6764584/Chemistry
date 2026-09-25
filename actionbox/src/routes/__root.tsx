import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CaptureProvider } from "@/components/add-sheet";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppQueryProvider } from "@/lib/query";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "ActionBox";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f2f3f5" },
      {
        name: "description",
        content: "저장만 하고 잊은 정보를, 필요한 순간 실제 행동으로 연결합니다.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="ko" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppQueryProvider>
            <CaptureProvider>
              <Outlet />
            </CaptureProvider>
            <Toaster
              position="bottom-center"
              offset={{ bottom: "calc(env(safe-area-inset-bottom) + 148px)" }}
              mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 148px)" }}
              toastOptions={{
                className: "font-sans",
                style: {
                  background: "var(--color-fg)",
                  color: "var(--color-surface)",
                  border: "none",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "var(--text-small)",
                },
                actionButtonStyle: {
                  background: "transparent",
                  color: "var(--color-primary-inverse)",
                  fontWeight: 600,
                  fontSize: "var(--text-small)",
                },
              }}
            />
          </AppQueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
