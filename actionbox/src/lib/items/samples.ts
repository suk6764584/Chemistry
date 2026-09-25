import { defaultReminder } from "./ai";
import type { Category } from "./types";

function svgDataUrl(svg: string): { base64: string; mime: string } {
  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return { base64: b64, mime: "image/svg+xml" };
}

function couponSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" rx="28" fill="#1E3932"/>
  <rect x="28" y="28" width="744" height="444" rx="18" fill="#F4F1EA"/>
  <text x="64" y="100" font-family="sans-serif" font-size="22" fill="#1E3932" letter-spacing="4">STARBUCKS</text>
  <text x="64" y="170" font-family="sans-serif" font-size="40" font-weight="700" fill="#1C1915">아메리카노</text>
  <text x="64" y="220" font-family="sans-serif" font-size="22" fill="#6F6A62">무료 음료 쿠폰</text>
  <rect x="64" y="280" width="280" height="64" rx="12" fill="#1E3932"/>
  <text x="204" y="320" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#F4F1EA">유효기간 2026.10.31</text>
  <text x="64" y="390" font-family="sans-serif" font-size="16" fill="#8F897E">매장에서 제시해 주세요</text>
</svg>`;
}

function eventSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#215E52"/>
  <rect x="40" y="40" width="720" height="420" fill="none" stroke="#F4F1EA" stroke-width="2"/>
  <text x="400" y="140" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#F4F1EA" letter-spacing="6">SEOUL</text>
  <text x="400" y="210" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="700" fill="#F4F1EA">2026 서울 AI 박람회</text>
  <text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#F4F1EA">2026.10.18  14:00</text>
  <text x="400" y="330" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#F4F1EA">COEX 서울 강남구</text>
  <text x="400" y="400" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#C8D5D0">입장 무료  ·  사전 등록</text>
</svg>`;
}

function placeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#F4F1EA"/>
  <rect x="0" y="0" width="800" height="70" fill="#ECE7DC"/>
  <text x="28" y="44" font-family="sans-serif" font-size="18" fill="#6F6A62">맛집 후기</text>
  <text x="48" y="150" font-family="sans-serif" font-size="36" font-weight="700" fill="#1C1915">을지면옥</text>
  <text x="48" y="200" font-family="sans-serif" font-size="20" fill="#6F6A62">서울 중구 충무로 24</text>
  <text x="48" y="260" font-family="sans-serif" font-size="18" fill="#1C1915">평양냉면 · 수육</text>
  <text x="48" y="310" font-family="sans-serif" font-size="18" fill="#6F6A62">점심 11:00–15:00  저녁 17:00–21:00</text>
  <text x="48" y="380" font-family="sans-serif" font-size="16" fill="#8F897E">줄이 길 수 있어요. 웨이팅 각오.</text>
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
  recommended_actions: string[];
};

export function sampleItems(): SampleInsert[] {
  const couponImg = svgDataUrl(couponSvg());
  const eventImg = svgDataUrl(eventSvg());
  const placeImg = svgDataUrl(placeSvg());

  return [
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: couponImg,
      title: "스타벅스 아메리카노",
      summary: "스타벅스 아메리카노 무료 쿠폰. 2026년 10월 31일까지 사용할 수 있습니다.",
      category: "coupon",
      extracted_date: null,
      extracted_time: null,
      expiration_date: "2026-10-31",
      location: "스타벅스",
      address: null,
      amount: null,
      phone: null,
      coupon_brand: "스타벅스",
      coupon_product: "아메리카노",
      recommended_actions: ["만료 7일 전 알림", "사용완료", "보관"],
    },
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: eventImg,
      title: "2026 서울 AI 박람회",
      summary: "서울 코엑스에서 열리는 AI 박람회. 10월 18일 오후 2시.",
      category: "event",
      extracted_date: "2026-10-18",
      extracted_time: "14:00",
      expiration_date: null,
      location: "COEX",
      address: "서울 강남구 영동대로 513",
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["캘린더 추가", "하루 전 알림", "지도 보기", "보관"],
    },
    {
      original_type: "screenshot",
      original_content: null,
      source_url: null,
      image: placeImg,
      title: "을지면옥",
      summary: "서울 중구 충무로의 평양냉면 맛집.",
      category: "place",
      extracted_date: null,
      extracted_time: null,
      expiration_date: null,
      location: "을지면옥",
      address: "서울 중구 충무로 24",
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["지도 열기", "가볼 곳 저장", "보관"],
    },
    {
      original_type: "url",
      original_content: "https://ko.react.dev/learn",
      source_url: "https://ko.react.dev/learn",
      title: "React 배우기",
      summary: "React 공식 문서의 학습 가이드. 컴포넌트, 상태, 렌더링을 순서대로 다룹니다.",
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
      recommended_actions: ["나중에 읽기", "완료", "보관"],
    },
    {
      original_type: "text",
      original_content: "자동차 검사 예약해야 함. 이번 주기 만료 전에 지정 정비소에서 받기. 날짜: 2026-10-02",
      source_url: null,
      title: "자동차 검사",
      summary: "2026년 10월 2일까지 자동차 검사를 받아야 합니다.",
      category: "todo",
      extracted_date: "2026-10-02",
      extracted_time: null,
      expiration_date: "2026-10-02",
      location: null,
      address: null,
      amount: null,
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["완료", "알림", "보관"],
    },
    {
      original_type: "url",
      original_content: "https://www.ikea.com/kr/ko/p/blahaj-soft-toy-shark-90373590/",
      source_url: "https://www.ikea.com/kr/ko/p/blahaj-soft-toy-shark-90373590/",
      title: "BLÅHAJ 블로하이 상어 인형",
      summary: "이케아 상어 인형. 나중에 살지 고민 중인 구매 후보.",
      category: "buy",
      extracted_date: null,
      extracted_time: null,
      expiration_date: null,
      location: null,
      address: null,
      amount: "26900",
      phone: null,
      coupon_brand: null,
      coupon_product: null,
      recommended_actions: ["링크 열기", "보관"],
    },
  ];
}

export function reminderForSample(sample: SampleInsert) {
  return defaultReminder(sample.category, sample.extracted_date, sample.expiration_date);
}
