import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useCallback, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  analyzeItem,
  createItem,
  deleteItem,
  deleteSamples,
  getItem,
  getItemImage,
  listItems,
  seedSamples,
  setItemsStatus,
  updateItem,
} from "@/lib/items/server";
import type { CreateItemInput, Item, ItemPatch } from "@/lib/items/types";
import { getAccountStatus, getAuthFeatures } from "@/lib/account/server";
import { isUnauthorized, todayISO } from "@/lib/utils";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, err) => !isUnauthorized(err) && count < 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Items deleted in the last few seconds: hidden everywhere while "되돌리기" is still
 * on screen, and only then deleted on the server (see `removeWithUndo`).
 */
const pendingDeletes = new Set<string>();
let pendingVersion = 0;
const pendingListeners = new Set<() => void>();

function changePending(change: () => void) {
  change();
  pendingVersion += 1;
  pendingListeners.forEach((l) => l());
}

function subscribePending(listener: () => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function useItems(enabled: boolean) {
  const version = useSyncExternalStore(subscribePending, () => pendingVersion, () => 0);
  const select = useCallback(
    (items: Item[]) => (pendingDeletes.size ? items.filter((i) => !pendingDeletes.has(i.id)) : items),
    // A new function whenever the pending set changes, so lists re-filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  return useQuery({ queryKey: ["items"], queryFn: () => listItems(), enabled, select });
}

export function useItem(id: string, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["item", id],
    queryFn: () => getItem({ data: id }),
    enabled,
    // Open instantly from the list we already have; the fetch refreshes it.
    initialData: () => qc.getQueryData<Item[]>(["items"])?.find((i) => i.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(["items"])?.dataUpdatedAt,
  });
}

/** Whether the signed-in user still has to agree to the current terms. */
export function useAccountStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["account-status"],
    queryFn: () => getAccountStatus(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useAuthFeatures() {
  return useQuery({ queryKey: ["auth-features"], queryFn: () => getAuthFeatures(), staleTime: Infinity });
}

export function useItemImage(id: string, hasImage: boolean) {
  return useQuery({
    queryKey: ["item-image", id],
    queryFn: () => getItemImage({ data: id }),
    enabled: hasImage,
    staleTime: 5 * 60_000,
  });
}

/** Ids whose analysis request is in flight from this tab. */
export function useAnalyzingIds(): string[] {
  return useMutationState({
    filters: { mutationKey: ["analyze"], status: "pending" },
    select: (m) => (m.state.variables as { id: string } | undefined)?.id ?? "",
  });
}

export function useItemMutations() {
  const qc = useQueryClient();

  // Callbacks live on the mutations (not on mutate calls) so the cache is
  // updated even if the component that started them has unmounted.
  const store = (item: Item) => {
    qc.setQueryData<Item[]>(["items"], (prev) =>
      prev ? [item, ...prev.filter((i) => i.id !== item.id)].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) : [item],
    );
    qc.setQueryData(["item", item.id], item);
  };

  const create = useMutation({
    mutationFn: (input: CreateItemInput) => createItem({ data: input }),
    onSuccess: store,
  });

  const analyze = useMutation({
    mutationKey: ["analyze"],
    mutationFn: (input: { id: string }) => analyzeItem({ data: { id: input.id, today: todayISO() } }),
    onSuccess: store,
    onError: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; patch: ItemPatch }) => updateItem({ data: input }),
    onSuccess: store,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteItem({ data: id }),
    onSuccess: (_, id) => {
      qc.setQueryData<Item[]>(["items"], (prev) => prev?.filter((i) => i.id !== id) ?? []);
      qc.removeQueries({ queryKey: ["item", id] });
      qc.removeQueries({ queryKey: ["item-image", id] });
    },
    // On the mutation (not the mutate call) so it still runs after the screen has closed.
    onError: () => toast.error("삭제하지 못했어요. 다시 시도해 주세요."),
    onSettled: (_, __, id) => changePending(() => pendingDeletes.delete(id)),
  });

  const seed = useMutation({
    mutationFn: () => seedSamples({ data: { today: todayISO() } }),
    onSuccess: (items) => qc.setQueryData(["items"], items),
  });

  const setMany = useMutation({
    mutationFn: (input: { ids: string[]; status: Item["status"] }) => setItemsStatus({ data: input }),
    onSuccess: (items) => qc.setQueryData(["items"], items),
  });

  const clearSamples = useMutation({
    mutationFn: () => deleteSamples(),
    onSuccess: (items) => qc.setQueryData(["items"], items),
  });

  /** Delete with an 8-second "되돌리기": hidden now, deleted on the server when the toast goes away. */
  const removeWithUndo = (id: string) => {
    changePending(() => pendingDeletes.add(id));
    let settled = false;
    const commit = () => {
      if (settled) return;
      settled = true;
      remove.mutate(id);
    };
    toast("삭제했어요", {
      duration: 8000,
      action: {
        label: "되돌리기",
        onClick: () => {
          settled = true;
          changePending(() => pendingDeletes.delete(id));
        },
      },
      onDismiss: commit,
      onAutoClose: commit,
    });
  };

  return { create, analyze, patch, remove, seed, setMany, clearSamples, removeWithUndo };
}
