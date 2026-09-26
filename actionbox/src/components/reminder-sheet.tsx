import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetRow } from "@/components/ui/sheet";
import { REMINDER_PRESETS, reminderPreset } from "@/lib/items/reminder";
import { keyDate, type Item, type ItemPatch } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { addDaysISO, formatDateWithWeekday, todayISO } from "@/lib/utils";

/**
 * Choosing when to be reminded — shared by the detail screen and the bell on a list row,
 * so tapping a bell never silently turns a reminder off.
 */
export function ReminderSheet({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { patch } = useItemMutations();
  const key = keyDate(item);
  const preset = reminderPreset(item);
  const [choosingDate, setChoosingDate] = useState(false);
  useEffect(() => {
    if (open) setChoosingDate(preset === "custom");
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setOpen = onOpenChange;
  const set = (next: ItemPatch) => {
    patch.mutate(
      { id: item.id, patch: next },
      { onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "저장하지 못했어요. 다시 시도해 주세요.") },
    );
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="알림 시점"
      description={key ? `기준일 ${formatDateWithWeekday(key)}` : "날짜가 없는 항목이라 알림 날짜를 직접 골라야 해요."}
    >
      <div className="mt-3 -mx-2" role="radiogroup" aria-label="알림 시점">
        <SheetRow
          role="radio"
          checked={!item.reminder_enabled}
          title="끄기"
          trailing={!item.reminder_enabled ? <Check className="size-5 text-primary" aria-hidden /> : null}
          onClick={() => set({ reminder_enabled: false })}
        />
        {key
          ? REMINDER_PRESETS.filter((p) => addDaysISO(key, -p.days) >= todayISO()).map((p) => (
              <SheetRow
                key={p.days}
                role="radio"
                checked={preset === p.days}
                title={p.label}
                hint={formatDateWithWeekday(addDaysISO(key, -p.days)) ?? undefined}
                trailing={preset === p.days ? <Check className="size-5 text-primary" aria-hidden /> : null}
                onClick={() => set({ reminder_enabled: true, reminder_date: addDaysISO(key, -p.days) })}
              />
            ))
          : null}
        <SheetRow
          role="radio"
          checked={preset === "custom"}
          title="날짜 직접 선택"
          trailing={preset === "custom" ? <Check className="size-5 text-primary" aria-hidden /> : null}
          onClick={() => setChoosingDate(true)}
        />
      </div>
      {choosingDate ? (
        <input
          type="date"
          aria-label="알림 날짜"
          defaultValue={item.reminder_date ?? ""}
          onChange={(e) => {
            if (e.target.value) set({ reminder_enabled: true, reminder_date: e.target.value });
          }}
          className="mt-2 h-13 w-full rounded-md bg-surface-2 px-4 text-body focus:shadow-focus focus:outline-none"
        />
      ) : null}
    </Sheet>
  );
}
