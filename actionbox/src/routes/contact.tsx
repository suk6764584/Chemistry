import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Blank, Bullets, Clause, LegalDoc } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: `문의하기 · ${SITE.serviceName}` }] }),
  component: ContactPage,
});

const MAIL_SUBJECT = `[${SITE.serviceName}] 문의`;
const MAIL_BODY = `문의 내용:\n\n\n\n---\n앱 버전: ${SITE.appVersion}\n가입한 이메일(계정 관련 문의일 때):`;

/** Public support page — reachable without signing in, as store listings expect. */
function ContactPage() {
  const mailto = SITE.supportEmail
    ? `mailto:${SITE.supportEmail}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`
    : null;

  // Some phones have no mail app set up, so the address can be copied instead.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE.supportEmail);
      toast("이메일 주소를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.");
    }
  };

  return (
    <LegalDoc title="문의하기">
      <p>이용 중 궁금한 점, 불편한 점, 오류 신고나 제안은 이메일로 보내 주세요. 받은 순서대로 이메일로 답변드립니다.</p>

      <Clause title="문의 이메일">
        <p className="text-body font-semibold select-all">
          <Blank value={SITE.supportEmail} />
        </p>
        {mailto ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild size="lg">
              <a href={mailto} className="!text-on-primary !no-underline">
                메일 쓰기
              </a>
            </Button>
            <Button variant="secondary" size="lg" onClick={() => void copy()}>
              주소 복사
            </Button>
          </div>
        ) : null}
        <p className="text-muted">
          계정에 관한 문의는 가입한 이메일 주소에서 보내 주시면 더 빨리 확인할 수 있어요. 오류가 있었다면 언제, 어떤 화면에서
          생겼는지 적어 주세요.
        </p>
      </Clause>

      <Clause title="먼저 확인해 보세요">
        <Bullets
          items={[
            <>
              비밀번호를 잊었어요 → <Link to="/forgot-password">비밀번호 재설정</Link>
            </>,
            <>
              계정과 데이터를 지우고 싶어요 → <Link to="/delete-account">계정 삭제 안내</Link>
            </>,
            <>
              내 정보가 어떻게 쓰이는지 궁금해요 → <Link to="/privacy">개인정보 처리방침</Link>
            </>,
          ]}
        />
      </Clause>
    </LegalDoc>
  );
}
