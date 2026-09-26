import { useItemImage } from "@/lib/query";
import { cn } from "@/lib/utils";

export function ItemImage({
  id,
  hasImage,
  alt,
  className,
}: {
  id: string;
  hasImage: boolean;
  alt: string;
  className?: string;
}) {
  const q = useItemImage(id, hasImage);
  if (!hasImage) return null;
  if (!q.data) {
    return <div className={cn("animate-pulse bg-surface-2", className)} />;
  }
  return (
    <img
      src={`data:${q.data.mime};base64,${q.data.base64}`}
      alt={alt}
      className={cn("bg-surface-2 object-cover", className)}
    />
  );
}
