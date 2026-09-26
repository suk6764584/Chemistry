import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAmount, parseDate, parseTime } from "./parse-text.ts";

const today = "2026-09-27";

test("dates", () => {
  assert.equal(parseDate("10월 2일까지 자동차 검사", today), "2026-10-02");
  assert.equal(parseDate("10월 10일 오후 3시 치과 예약", today), "2026-10-10");
  assert.equal(parseDate("2026.11.3 공연", today), "2026-11-03");
  assert.equal(parseDate("2025-12-31 마감", today), "2025-12-31");
  assert.equal(parseDate("10/5 모임", today), "2026-10-05");
  assert.equal(parseDate("1월 5일 신년회", today), "2027-01-05");
  assert.equal(parseDate("내일 저녁 8시", today), "2026-09-28");
  assert.equal(parseDate("모레 병원", today), "2026-09-29");
  assert.equal(parseDate("우유 사기", today), null);
  assert.equal(parseDate("2월 30일", today), null);
});

test("times", () => {
  assert.equal(parseTime("오후 3시 치과"), "15:00");
  assert.equal(parseTime("오후 4시 30분"), "16:30");
  assert.equal(parseTime("저녁 8시"), "20:00");
  assert.equal(parseTime("오전 10시 반"), "10:30");
  assert.equal(parseTime("23:59 마감"), "23:59");
  assert.equal(parseTime("3시"), "15:00");
  assert.equal(parseTime("새벽 3시"), "03:00");
  assert.equal(parseTime("8시간 금식"), null);
  assert.equal(parseTime("우유 사기"), null);
});

test("amounts", () => {
  assert.equal(parseAmount("학원비 25만원"), "250,000원");
  assert.equal(parseAmount("250,000원 납부"), "250,000원");
  assert.equal(parseAmount("3만 5천원"), "35,000원");
  assert.equal(parseAmount("12000원"), "12,000원");
  assert.equal(parseAmount("원래 계획"), null);
});
