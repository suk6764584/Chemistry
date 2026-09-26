import assert from "node:assert/strict";
import { test } from "node:test";
import { sharedText } from "./share.ts";

const share = (text: string, url = "", title = "") => sharedText({ text, url, title });

test("a shared link is saved as a link", () => {
  assert.deepEqual(share("https://m.blog.naver.com/abc/123"), { kind: "url", value: "https://m.blog.naver.com/abc/123" });
  // Browsers and blog apps put the page title in front of the link.
  assert.deepEqual(share("성수 브런치 맛집 정리 https://blog.example.com/p/1"), { kind: "url", value: "https://blog.example.com/p/1" });
  assert.deepEqual(share("", "https://shop.example.com/item/9", "상품"), { kind: "url", value: "https://shop.example.com/item/9" });
  assert.deepEqual(share("볼 것", "https://news.example.com/a"), { kind: "url", value: "https://news.example.com/a" });
});

test("a message with a link stays a memo", () => {
  const msg = "10월 3일 저녁 7시 모임\n장소: 강남역 2번 출구\nhttps://map.example.com/x";
  assert.deepEqual(share(msg), { kind: "text", value: msg });
});

test("plain text is a memo; nothing to save is null", () => {
  assert.deepEqual(share("  다음 주 화요일까지 서류 제출  "), { kind: "text", value: "다음 주 화요일까지 서류 제출" });
  assert.deepEqual(share("", "", "제목만"), { kind: "text", value: "제목만" });
  assert.equal(share("", "", ""), null);
});
