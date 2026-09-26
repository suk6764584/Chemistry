/**
 * Operator details and policy versions — the one place to fill in before launch.
 *
 * Nothing here is invented: every blank is shown on the legal pages as
 * "출시 전 입력 필요" until it is filled, so an unfinished policy can't ship
 * looking complete. Bump a version (use the effective date) whenever the
 * document changes; signed-in users are asked to agree again.
 */
type SiteConfig = {
  serviceName: string;
  appVersion: string;
  operator: string;
  representative: string;
  businessNumber: string;
  address: string;
  supportEmail: string;
  privacyOfficer: { name: string; email: string };
  databaseRegion: string;
  backupRetention: string;
  termsVersion: string;
  privacyVersion: string;
};

export const SITE: SiteConfig = {
  serviceName: "ActionBox",
  appVersion: "1.0.0",

  /** 운영자: 회사명, 또는 개인 운영 시 성명 */
  operator: "",
  /** 대표자 성명 (사업자인 경우) */
  representative: "",
  /** 사업자등록번호 (사업자인 경우) */
  businessNumber: "",
  /** 사업장 주소 (사업자인 경우) */
  address: "",
  /** 이용자 문의를 받을 이메일 */
  supportEmail: "",

  /** 개인정보 보호책임자 (개인정보 보호법 제31조) */
  privacyOfficer: { name: "", email: "" },

  /**
   * Where the database runs. Set this after checking the project settings of
   * the Postgres provider (e.g. Neon region) — it is disclosed in the privacy policy.
   */
  databaseRegion: "",
  /** DB 백업(시점 복구) 보관 기간. 백업을 끄면 "백업 없음". */
  backupRetention: "",

  /** 시행일 = 버전. 문서를 바꾸면 날짜를 올려 주세요. */
  termsVersion: "2026-09-26",
  privacyVersion: "2026-09-26",
};

export const MISSING = "출시 전 입력 필요";

/** Required fields still blank — shown as a warning on the legal pages. */
export function missingSiteFields(): string[] {
  const missing: string[] = [];
  if (!SITE.operator) missing.push("운영자");
  if (!SITE.supportEmail) missing.push("문의 이메일");
  if (!SITE.privacyOfficer.name) missing.push("개인정보 보호책임자 성명");
  if (!SITE.privacyOfficer.email) missing.push("개인정보 보호책임자 연락처");
  if (!SITE.databaseRegion) missing.push("데이터베이스 저장 국가");
  if (!SITE.backupRetention) missing.push("백업 보관 기간");
  return missing;
}

export function formatVersionDate(version: string): string {
  const [y, m, d] = version.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
