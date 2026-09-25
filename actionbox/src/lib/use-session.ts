import { useSyncExternalStore } from "react";
import { useCurrentUserState, type CurrentUserState } from "@/lib/auth/use-current-user";

const subscribeToNothing = () => () => {};

/**
 * `useCurrentUserState`, but still "pending" until hydration finishes. The
 * server always renders the loading state; if the session resolved on the
 * client before hydration, rendering it right away would not match that HTML.
 */
export function useSession(): CurrentUserState {
  const state = useCurrentUserState();
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  return hydrated ? state : { user: null, isPending: true };
}
