export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
      <p className="text-[15px] font-semibold">목록을 불러오지 못했어요</p>
      <p className="mt-1 text-[13px] text-subtle">인터넷 연결을 확인한 뒤 다시 시도해 주세요. 저장된 항목은 그대로 있어요.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-11 rounded-md bg-surface-2 px-4 text-[14px] font-semibold active:bg-surface-3"
      >
        다시 불러오기
      </button>
    </div>
  );
}
