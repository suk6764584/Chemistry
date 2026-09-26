import { createFileRoute } from "@tanstack/react-router";

// Shares are normally caught by the service worker (public/sw.js). This only
// runs when it is not installed yet: open the app instead of an error page.
const toHome = ({ request }: { request: Request }) => Response.redirect(new URL("/", request.url), 303);

export const Route = createFileRoute("/share-target")({
  server: { handlers: { GET: toHome, POST: toHome } },
});
