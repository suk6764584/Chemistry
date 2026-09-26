# ActionBox 출시 체크리스트 (목표: Google Play)

원칙: **지금은 무료로 시작하고, 앱이 잘 되면 유료로 바꾼다.**
표기: ✅ 구현·검증함 / ⬜ 운영자가 할 일 / ⚠️ 확인 필요(단정하지 않음)

---

## 1. 앱에 구현된 것

| 기능 | 위치 | 동작 |
|---|---|---|
| 이용약관 / 개인정보 처리방침 | `/terms`, `/privacy` | 운영자 정보(미소테크, 대표·보호책임자 강무근, rdx840021@gmail.com) 반영 |
| 가입 동의 | `/login` 가입 | 만 14세 이상·약관·개인정보 필수 동의, AI 국외 전송 안내 |
| 동의 기록·재동의 | `consent_log`, `/agree` | 약관 버전이 바뀌면 로그인 사용자에게 다시 동의 받음 |
| 설정·회원 탈퇴 | `/settings` | 즉시 삭제 |
| **계정 삭제 웹페이지** | `/delete-account` | 앱 없이도 삭제 가능(로그인 후 삭제 또는 이메일 요청). Google Play 요구사항 대응 |
| 비밀번호 재설정 | `/forgot-password` | 메일 서비스 미연결 상태 → "지금은 이용 불가, 문의 이메일" 안내 |
| AI 자동 분석 | `src/lib/items/ai.ts` | **OpenAI**(`OPENAI_API_KEY`). 키가 없으면 AI 없이 동작(원본 저장 + 직접 입력) |
| AI 비용 상한 | `src/lib/items/server.ts` | 1인 하루 50회(`AI_DAILY_LIMIT`) |
| 앱 아이콘·매니페스트 | `public/manifest.webmanifest`, `public/icons/` | Play 포장(TWA)에 필요 |
| Grok 플랫폼 연동 제거 | — | Grok 로그인 중계, 자동 로그인, "Created with Grok" 표시, 미리보기 연동, xAI 키 |
| 배포 설정 누락 방지 | `src/lib/auth/server.ts` | DB가 연결됐는데 `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`이 없으면 로그인 서버가 멈추고 이유를 기록 |

---

## 2. 서비스 구성 — 무료로 시작하기

| 용도 | 지금 (무료) | 나중에 (잘 되면) | 확인된 사실 |
|---|---|---|---|
| 데이터베이스 | **Supabase Free, 서울 리전** | Supabase Pro | 서울(ap-northeast-2) 리전 있음. 무료는 DB 500MB, 7일간 활동이 없으면 일시 정지 |
| 서버(호스팅) | Vercel Hobby (테스트 기간) | Vercel Pro 또는 다른 호스팅 | ⚠️ Vercel Hobby는 **비상업·개인 용도만** 허용. 회사(미소테크)로 정식 출시하면 유료 전환이나 다른 호스팅이 필요할 수 있음 |
| AI 분석 | **키 없이 출시**(AI 꺼짐, 무료) | OpenAI 키 연결 | OpenAI API는 무료 제공량이 없고 최소 5달러 선불. API 데이터는 기본적으로 학습에 쓰지 않고, 남용 감시용으로 최대 30일 보관 |
| 비밀번호 재설정 메일 | 사용 안 함 | Resend 등 연결 | — |
| 도메인 | `프로젝트이름.vercel.app` | 자체 도메인 | 앱 주소가 바뀌면 Play 포장을 다시 해야 하므로 가능하면 처음부터 정해 두기 |
| Google Play 개발자 계정 | 등록비 25달러(1회) | — | 무료 대안 없음 |

**무료 AI를 권하지 않는 이유:** Gemini API 무료 등급은 입력 내용이 Google 서비스 개선에 쓰일 수 있고 사람이 검토할 수 있습니다. Google도 무료 등급에 개인정보를 넣지 말라고 안내합니다. 이 앱은 사용자 스크린샷(개인정보 포함)을 보내므로 맞지 않습니다.

---

## 3. 배포할 때 넣을 환경 변수

| 변수 | 필수 | 값 |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase 대시보드 → Connect → **pooler** 연결 문자열 (서버리스 환경용) |
| `BETTER_AUTH_SECRET` | ✅ | 32바이트 이상 무작위 문자열 (예: `openssl rand -hex 32` 결과) |
| `BETTER_AUTH_URL` | ✅ | 앱 공개 주소 (예: `https://actionbox.vercel.app`) |
| `OPENAI_API_KEY` | 선택 | 넣으면 AI 분석이 켜짐 |
| `AI_MODEL` | 선택 | 기본 `gpt-4.1-mini` |
| `AI_DAILY_LIMIT` | 선택 | 기본 50 |

- `npm run build`는 `DATABASE_URL`이 있으면 `migrations/*.sql`을 DB에 적용합니다.
- ⚠️ `site.ts`의 `databaseRegion: "대한민국"`은 **Supabase 프로젝트를 서울 리전으로 만들 때만** 사실입니다. 다른 리전이나 서비스를 쓰면 `site.ts`를 고쳐야 합니다.

---

## 4. Google Play 출시 순서 (웹앱을 TWA로 포장)

1. ⬜ 배포해서 HTTPS 주소 확보 (3장)
2. ⬜ [Play Console](https://play.google.com/console) 개발자 계정 등록 (25달러)
   - **개인 계정**(2023-11-13 이후 생성): 정식 출시 전에 **테스터 12명이 14일 이상** 비공개 테스트에 참여해야 함
   - **조직 계정**(D-U-N-S 번호 필요)은 이 요건이 면제. 미소테크가 사업자라면 검토할 만함
3. ⬜ [PWABuilder](https://www.pwabuilder.com)에 앱 주소를 넣고 Android 패키지(.aab) 생성
4. ⬜ PWABuilder가 주는 `assetlinks.json`을 받으면 저에게 주세요 → `public/.well-known/assetlinks.json`으로 넣겠습니다
   - 이 파일이 없거나 틀리면 앱 위에 브라우저 주소창이 보입니다
5. ⬜ Play Console 입력
   - 개인정보 처리방침 URL: `https://<주소>/privacy`
   - 계정 삭제 URL: `https://<주소>/delete-account`
   - 데이터 보안 양식: 처리방침 2항(수집 항목)과 일치시키기

---

## 5. 남은 일 / 알려진 한계

- ⬜ **Grok 전용 파일 삭제 (권한 필요):** 연결은 끊었지만 파일은 남아 있습니다.
  - `src/lib/app-data/`, `src/lib/env.server.ts`, `src/lib/preview-host-bridge.ts`, `src/lib/preview-embedder-origin.ts`, `src/components/preview-host-bridge.tsx`
  - `src/lib/auth/{providers,preview,popup.server,gate-identity.server,gate-identity.test,gate-session.server,gate-session-marker}.ts`
  - `server/`, `public/__grok/`, `scripts/grok-pwa-plugin.mjs`, `scripts/grok-pwa-plugin.test.mjs`, `scripts/install-page.html`
  - 삭제 후 `tsconfig.json`의 임시 `exclude` 한 줄도 지웁니다.
- **사진을 DB에 저장합니다.** Supabase 무료 500MB는 사진이 많아지면 빨리 찹니다. 사용자가 늘면 사진을 Storage로 옮기는 작업이 필요합니다.
- **가입 이메일 인증이 없습니다.** 메일 서비스를 연결하면 켤 수 있습니다.
- **구글 로그인이 없습니다.** Grok 중계를 뺐기 때문에 지금은 이메일 로그인만 됩니다. 필요하면 Google 로그인을 직접 연결할 수 있습니다(Google Cloud OAuth, 무료).
- **약관 개정 공지는 직접 해야 합니다.** 약관상 적용 7일 전(불리한 변경은 30일 전) 공지해야 합니다.
- 다른 기기 로그아웃은 최대 5분 늦을 수 있습니다(로그인 캐시).
- 사업자등록번호와 주소는 입력하지 않았습니다(선택 항목).

---

## 6. 약관·처리방침을 바꿀 때

1. `src/routes/terms.tsx` 또는 `src/routes/privacy.tsx` 수정
2. `src/lib/site.ts`의 `termsVersion` / `privacyVersion`을 새 시행일로 변경
3. 배포 → 로그인 사용자는 다음 방문 때 `/agree`에서 다시 동의
4. 외부 서비스(DB·AI·호스팅)를 바꾸면 `site.ts`의 해당 값과 처리방침 6항도 함께 수정
