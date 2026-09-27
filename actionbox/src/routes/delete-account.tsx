import { createFileRoute, Link } from "@tanstack/react-router";
import { Blank, Bullets, Clause, LegalDoc } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [{ title: `계정 삭제 안내 · ${SITE.serviceName}` }] }),
  component: DeleteAccountPage,
});

const MAIL_SUBJECT = `[${SITE.serviceName}] 계정 삭제 요청`;
const MAIL_BODY = "가입한 이메일 주소:\n\n위 계정과 저장한 모든 데이터를 삭제해 주세요.";

/**
 * Public account-deletion page — the "web link" Google Play asks for, usable
 * without installing the app. Names the app and the developer as listed.
 */
function DeleteAccountPage() {
  const mailto = SITE.supportEmail
    ? `mailto:${SITE.supportEmail}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`
    : null;

  return (
    <LegalDoc title={`${SITE.serviceName} 계정 삭제`}>
      <p>
        {SITE.serviceName} 앱(개발자: <Blank value={SITE.operator} />
        )의 계정과 저장한 데이터를 삭제하는 방법입니다. 앱을 설치하지 않아도 이 페이지에서 요청할 수 있습니다.
      </p>

      <Clause title="방법 1. 직접 삭제 (바로 처리)">
        <Bullets
          items={[
            "앱을 열거나 아래 버튼으로 이 사이트에 로그인합니다.",
            "오른쪽 위 계정 버튼 → 설정 → 회원 탈퇴를 누릅니다.",
            "안내를 확인하고 ‘탈퇴하기’를 누르면 즉시 삭제됩니다.",
          ]}
        />
        <Button asChild size="lg" className="mt-2 w-full">
          <Link to="/login" search={{ next: "/settings" }} className="!text-on-primary !no-underline">
            로그인하고 삭제하기
          </Link>
        </Button>
      </Clause>

      <Clause title="방법 2. 이메일로 요청 (로그인할 수 없을 때)">
        <p>
          가입한 이메일 주소에서 <Blank value={SITE.supportEmail} />로 ‘계정 삭제 요청’을 보내 주세요. 본인 확인을 위해 가입한
          이메일 주소로 보낸 요청만 처리하며, 확인 후 지체 없이 삭제하고 결과를 이메일로 알려 드립니다.
        </p>
        {mailto ? (
          <Button asChild variant="secondary" size="lg" className="mt-2 w-full">
            <a href={mailto} className="!text-fg !no-underline">
              삭제 요청 메일 쓰기
            </a>
          </Button>
        ) : null}
      </Clause>

      <Clause title="삭제되는 정보">
        <Bullets
          items={[
            "계정 정보: 이메일, 이름, 비밀번호 또는 Google 로그인 연결 정보",
            "저장한 모든 항목: 사진·스크린샷·텍스트·링크와 그로부터 추출한 정보, 알림 설정",
            "약관 동의 기록, 자동 분석 이용 횟수, 로그인 기록",
          ]}
        />
      </Clause>

      <Clause title="삭제 후에도 잠시 남는 정보">
        <Bullets
          items={[
            <>
              데이터베이스 백업에 남은 사본: <Blank value={SITE.backupRetention} /> 이내에 함께 삭제됩니다.
            </>,
            "자동 분석을 위해 Google에 보낸 내용: Google 정책에 따라 처리됩니다. 무료 등급 이용 중에 보낸 내용은 Google의 서비스 개선에 쓰일 수 있습니다.",
            "자동 분석을 위해 OpenAI에 보낸 내용: OpenAI 정책에 따라 보관 후 삭제됩니다(작성일 기준 안내: 최대 30일).",
            "이 밖에 따로 보관하는 정보는 없습니다.",
          ]}
        />
      </Clause>
    </LegalDoc>
  );
}
