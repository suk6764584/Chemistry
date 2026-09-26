import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  analyzeItem,
  createItem,
  deleteItem,
  getItem,
  getItemImage,
  listItems,
  seedSamples,
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

export function useItems(enabled: boolean) {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
    enabled,
  });
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
  });

  const seed = useMutation({
    mutationFn: () => seedSamples({ data: { today: todayISO() } }),
    onSuccess: (items) => qc.setQueryData(["items"], items),
  });

  return { create, analyze, patch, remove, seed };
}
