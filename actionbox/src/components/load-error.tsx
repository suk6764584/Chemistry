import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <ListGroup className="px-5 py-6 text-center">
      <p className="text-body font-semibold">목록을 불러오지 못했어요</p>
      <p className="mt-1 text-small text-muted">인터넷 연결을 확인한 뒤 다시 시도해 주세요. 저장된 항목은 그대로 있어요.</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        다시 불러오기
      </Button>
    </ListGroup>
  );
}
