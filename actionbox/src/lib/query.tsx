import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  createItem,
  deleteItem,
  getItem,
  getItemImage,
  listItems,
  reanalyzeItem,
  seedSamples,
  updateItem,
} from "@/lib/items/server";
import type { CreateItemInput, Item, ItemPatch } from "@/lib/items/types";
import { isUnauthorized } from "@/lib/utils";

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
  return useQuery({
    queryKey: ["item", id],
    queryFn: () => getItem({ data: id }),
    enabled,
  });
}

export function useItemImage(id: string, hasImage: boolean) {
  return useQuery({
    queryKey: ["item-image", id],
    queryFn: () => getItemImage({ data: id }),
    enabled: hasImage,
    staleTime: 5 * 60_000,
  });
}

export function useItemMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["items"] });

  const create = useMutation({
    mutationFn: (input: CreateItemInput) => createItem({ data: input }),
    onSuccess: (item) => {
      qc.setQueryData<Item[]>(["items"], (prev) => {
        if (!prev) return [item];
        return [item, ...prev.filter((i) => i.id !== item.id)];
      });
      qc.setQueryData(["item", item.id], item);
    },
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; patch: ItemPatch }) => updateItem({ data: input }),
    onSuccess: (item) => {
      qc.setQueryData<Item[]>(["items"], (prev) =>
        prev ? prev.map((i) => (i.id === item.id ? item : i)) : [item],
      );
      qc.setQueryData(["item", item.id], item);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteItem({ data: id }),
    onSuccess: (_, id) => {
      qc.setQueryData<Item[]>(["items"], (prev) => prev?.filter((i) => i.id !== id) ?? []);
      qc.removeQueries({ queryKey: ["item", id] });
    },
  });

  const seed = useMutation({
    mutationFn: () => seedSamples(),
    onSuccess: (items) => {
      qc.setQueryData(["items"], items);
    },
  });

  const reanalyze = useMutation({
    mutationFn: (id: string) => reanalyzeItem({ data: id }),
    onSuccess: (item) => {
      if (!item) return;
      qc.setQueryData<Item[]>(["items"], (prev) =>
        prev ? prev.map((i) => (i.id === item.id ? item : i)) : [item],
      );
      qc.setQueryData(["item", item.id], item);
    },
  });

  return { create, patch, remove, seed, reanalyze, invalidate };
}
