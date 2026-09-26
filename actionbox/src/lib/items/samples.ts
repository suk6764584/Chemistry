import { addDaysISO } from "@/lib/utils";
import { defaultReminder } from "./reminder";
import type { ActionCode, Category } from "./types";

function svgImage(svg: string): { base64: string; mime: string } {
  return { base64: Buffer.from(svg, "utf8").toString("base64"), mime: "image/svg+xml" };
}

function dotted(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `${y}.${m}.${d}`;
}

function couponSvg(expires: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" rx="28" fill="#1E3932"/>
  <rect x="28" y="28" width="744" height="444" rx="18" fill="#F4F1EA"/>
  <text x="64" y="100" font-family="sans-serif" font-size="22" fill="#1E3932" letter-spacing="4">STARBUCKS</text>
  <text x="64" y="170" font-family="sans-serif" font-size="40" font-weight="700" fill="#1C1915">아메리카노 Tall</text>
  <text x="64" y="220" font-family="sans-serif" font-size="22" fill="#6F6A62">모바일 교환권</text>
  <rect x="64" y="280" width="320" height="64" rx="12" fill="#1E3932"/>
  <text x="224" y="320" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#F4F1EA">유효기간 ${dotted(expires)}</text>
  <text x="64" y="390" font-family="sans-serif" font-size="16" fill="#8F897E">매장에서 바코드를 제시해 주세요</text>
</svg>`;
}

function eventSvg(date: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#14213D"/>
  <rect x="40" y="40" width="720" height="420" fill="none" stroke="#FCA311" stroke-width="3"/>
  <text x="400" y="140" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#FCA311" letter-spacing="6">SEOUL</text>
  <text x="400" y="210" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="700" fill="#FFFFFF">2026 서울 AI 박람회</text>
  <text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#FFFFFF">${dotted(date)}  14:00</text>
  <text x="400" y="330" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#E5E5E5">COEX · 서울 강남구 영동대로 513</text>
  <text x="400" y="400" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#BFC5D2">사전 등록 필수</text>
</svg>`;
}

function placeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#FFFFFF"/>
  <rect x="0" y="0" width="800" height="70" fill="#F2F2F2"/>
  <text x="28" y="44" font-family="sans-serif" font-size="18" fill="#555555">맛집 기록</text>
  <text x="48" y="150" font-family="sans-serif" font-size="36" font-weight="700" fill="#111111">을지면옥</text>
  <text x="48" y="200" font-family="sans-serif" font-size="20" fill="#555555">서울 중구</text>
  <text x="48" y="260" font-family="sans-serif" font-size="18" fill="#111111">평양냉면 · 수육</text>
  <text x="48" y="330" font-family="sans-serif" font-size="16" fill="#888888">줄이 길 수 있어요. 평일 점심 추천.</text>
</svg>`;
}

export type SampleInsert = {
  original_type: "screenshot" | "url" | "text";
  original_content: string | null;
  source_url: string | null;
  image?: { base64: string; mime: string };
  title: string;
  summary: string;
  category: Category;
  extracted_date: string | null;
  extracted_time: string | null;
  expiration_date: string | null;
  location: string | null;
  address: string | null;
  amount: string | null;
  phone: string | null;
  coupon_brand: string | null;
  coupon_product: string | null;
  recommended_actions: ActionCode[];
};

/** The six test items from the product brief, dated relative to `today` so they stay meaningful. */
export function sampleItems(today: string): SampleInsert[] {
  const couponExpires = addDaysISO(today, 12);
  const eventDate = addDaysISO(today, 10);
  const carDeadline = addDaysISO(today, 5);
  const [, carM, carD] = carDeadline.split("-").map(Number);

  return [
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: svgImage(couponSvg(couponExpires)),
      title: "스타벅스 아메리카노",
      summary: "스타벅스 아메리카노 Tall 모바일 교환권. 유효기간 안에 매장에서 사용하세요.",
      category: "coupon",
      extracted_date: null,
      extracted_time: null,
      expiration_date: couponExpires,
      location: null,
      address: null,
      amount: null,
      phone: null,
      coupon_brand: "스타벅스",
      coupon_product: "아메리카노 Tall",
      recommended_actions: ["remind", "complete", "archive"],
    },
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: svgImage(eventSvg(eventDate)),
      title: "2026 서울 AI 박람회",
      summary: "COEX에서 열리는 AI 박람회. 사전 등록이 필요합니다.",
      category: "event",
      extracted_date: eventDate,
      extracted_time: "14:00",
      expiration_date: null,
      location: "COEX",
      address: "서울 강남구 영동대로 513",
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["calendar", "remind", "map", "archive"],
    },
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: svgImage(placeSvg()),
      title: "을지면옥",
      summary: "평양냉면·수육 맛집. 평일 점심이 덜 붐빈다는 메모.",
      category: "place",
      extracted_date: null,
      extracted_time: null,
      expiration_date: null,
      location: "을지면옥",
      address: "서울 중구",
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["map", "visit", "archive"],
    },
    {
      original_type: "url",
      original_content: "https://ko.react.dev/learn",
      source_url: "https://ko.react.dev/learn",
      title: "빠르게 시작하기 – React",
      summary: "React 공식 문서의 입문 가이드. 컴포넌트, 상태, 이벤트 처리를 순서대로 다룹니다.",
      category: "read",
      extracted_date: null,
      extracted_time: null,
      expiration_date: null,
      location: null,
      address: null,
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["open", "complete", "archive"],
    },
    {
      original_type: "text",
      original_content: `자동차 정기검사 받아야 함. 검사 기간 ${carM}월 ${carD}일까지. 가까운 검사소 예약하기.`,
      source_url: null,
      title: "자동차 정기검사",
      summary: `${carM}월 ${carD}일까지 자동차 정기검사를 받아야 합니다.`,
      category: "todo",
      extracted_date: null,
      extracted_time: null,
      expiration_date: carDeadline,
      location: null,
      address: null,
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["today", "complete", "remind"],
    },
    {
      original_type: "url",
      original_content: "https://www.ikea.com/kr/ko/p/blahaj-soft-toy-shark-90373590/",
      source_url: "https://www.ikea.com/kr/ko/p/blahaj-soft-toy-shark-90373590/",
      title: "BLÅHAJ 상어 인형",
      summary: "이케아 상품 페이지. 살지 고민 중인 구매 후보.",
      category: "buy",
      extracted_date: null,
      extracted_time: null,
      expiration_date: null,
      location: null,
      address: null,
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["open", "archive"],
    },
  ];
}

export function reminderForSample(sample: SampleInsert, today?: string) {
  return defaultReminder(sample.category, sample.extracted_date, sample.expiration_date, today);
}
