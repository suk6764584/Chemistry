import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SITE } from "@/lib/site";

export type Consent = { age: boolean; terms: boolean; privacy: boolean };
export const NO_CONSENT: Consent = { age: false, terms: false, privacy: false };
export const hasAllConsent = (c: Consent) => c.age && c.terms && c.privacy;

/**
 * Sign-up agreement: 14+ confirmation, terms, and privacy collection/use, all
 * required. The privacy row states purpose, items, retention and the right to
 * refuse, and says up front that saved content goes to an overseas AI service.
 */
export function ConsentChecklist({ value, onChange }: { value: Consent; onChange: (next: Consent) => void }) {
  const all = hasAllConsent(value);
  return (
    <fieldset className="rounded-lg bg-surface-2">
      <legend className="sr-only">약관 동의</legend>
      <CheckRow
        checked={all}
        onChange={(v) => onChange({ age: v, terms: v, privacy: v })}
        label={<span className="font-semibold">전체 동의</span>}
      />
      <div className="mx-4 h-px bg-line" />
      <CheckRow
        checked={value.age}
        onChange={(v) => onChange({ ...value, age: v })}
        label={<Required>만 14세 이상이에요</Required>}
      />
      <CheckRow
        checked={value.terms}
        onChange={(v) => onChange({ ...value, terms: v })}
        label={<Required>이용약관 동의</Required>}
        link="/terms"
      />
      <CheckRow
        checked={value.privacy}
        onChange={(v) => onChange({ ...value, privacy: v })}
        label={<Required>개인정보 수집·이용 동의</Required>}
        link="/privacy"
      />
      <div className="mx-4 mb-3 rounded-md bg-surface px-3 py-2.5 text-small text-muted">
        <dl className="space-y-0.5">
          <Fact term="목적">회원 관리, 저장한 항목의 보관·자동 분석·알림</Fact>
          <Fact term="항목">이메일, 비밀번호, 저장한 사진·텍스트·링크, 접속 기록</Fact>
          <Fact term="보유">회원 탈퇴 시까지 (탈퇴하면 즉시 삭제)</Fact>
        </dl>
        <p className="mt-1.5">
          저장한 사진·텍스트·링크는 자동 분석을 위해 생성형 AI 서비스({SITE.ai.name}, {SITE.ai.country})로 전송돼요. 동의하지
          않을 수 있지만, 그러면 가입할 수 없어요.
        </p>
      </div>
    </fieldset>
  );
}

function Required({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="text-primary">[필수]</span> {children}
    </>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-8 shrink-0 font-medium text-fg">{term}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  link,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  link?: "/terms" | "/privacy";
}) {
  return (
    <div className="flex min-h-12 items-center pr-2">
      <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 pl-4 text-body">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-primary"
        />
        <span>{label}</span>
      </label>
      {link ? (
        <Link to={link} target="_blank" className="hit-area px-2 text-small font-medium text-muted underline underline-offset-2">
          보기
        </Link>
      ) : null}
    </div>
  );
}
