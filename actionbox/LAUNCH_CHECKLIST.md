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
| **Google 로그인** | `/login` | `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`을 넣으면 버튼이 나타남. 처음 로그인하면 `/agree`에서 약관 동의 |
| **문의 페이지** | `/contact` | 로그인 없이 열림. 메일 쓰기(제목·앱 버전 자동 입력), 주소 복사. 앱 하단·설정의 ‘문의’가 이 페이지로 연결 |
| **공유하기로 저장** | `public/sw.js`, `manifest.webmanifest`의 `share_target` | 갤러리·카카오톡·브라우저에서 ‘공유 → ActionBox’ → 바로 저장·분석. 사진은 한 번에 10장까지. 로그인 전이면 로그인 후 저장 |
| **사진 여러 장 한 번에** | 저장 시트 | 최대 10장, 장마다 진행 상태 표시, 실패한 것만 다시 시도 |
| **직접 입력 간소화** | 항목 → 수정 | 분류에 맞는 칸만 먼저 보이고 나머지는 ‘항목 더 보기’. 빈 날짜 칸에 오늘·내일·이번 주말·다음 주 버튼 |
| 비밀번호 재설정 | `/forgot-password` | 메일 서비스 미연결 상태 → "지금은 이용 불가, 문의 이메일" 안내 |
| AI 자동 분석 | `src/lib/items/ai.ts` | **Google Gemini**(`GEMINI_API_KEY`) 먼저, 실패하거나 무료 한도를 넘으면 **OpenAI**(`OPENAI_API_KEY`). 둘 다 없으면 AI 없이 동작(원본 저장 + 직접 입력) |
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
| AI 분석 | **Google AI Studio 무료 키**(테스트 기간) → 막히면 OpenAI | 학습에 쓰이지 않는 유료 등급(OpenAI 또는 Gemini 유료) | Google 무료 등급: 입력을 서비스 개선에 쓰고 사람이 검토할 수 있으며, **개인정보를 넣지 말라고 안내**. OpenAI: 기본은 선불(최소 5달러)이고 학습에 쓰지 않음. 데이터 공유를 켜면 무료 토큰을 주는 프로그램이 있으나 그 경우 학습에 쓰임 |
| 비밀번호 재설정 메일 | 사용 안 함 | Resend 등 연결 | — |
| 도메인 | `프로젝트이름.vercel.app` | 자체 도메인 | 앱 주소가 바뀌면 Play 포장을 다시 해야 하므로 가능하면 처음부터 정해 두기 |
| Google Play 개발자 계정 | 등록비 25달러(1회) | — | 무료 대안 없음 |

### ⚠️ 출시 전 반드시 결정: 무료 AI
지금은 운영자 결정에 따라 **Google 무료 키를 먼저** 씁니다(개발·테스트 기간). 처리방침 6·7항과 가입 동의에 “무료 등급 이용 중에는 Google이 서비스 개선(AI 학습 포함)에 쓸 수 있음”을 적어 두었습니다. 그러나 실제 사용자를 받기 전에는 아래 중 하나가 필요합니다.
- **유료(학습 안 함)로 전환(권장):** Vercel에서 `GEMINI_API_KEY`를 지우고 OpenAI만 쓰거나(데이터 공유 끔), Google Cloud 결제를 연결해 Gemini 유료 등급으로 바꿉니다. 그 뒤 처리방침 6·7항에서 학습 문구를 빼고 `privacyVersion`을 올립니다.
- **무료를 계속 쓰려면:** Google 약관이 무료 등급에 개인정보를 넣지 말라고 하고, 개인정보보호법상 제3자의 학습 목적 이용은 별도 동의가 필요할 수 있습니다. 이 경우 법률 검토를 받고 동의 구조를 바꿔야 합니다.
- OpenAI의 “데이터 공유 → 무료 토큰”을 켜는 경우도 같습니다(학습에 쓰임). 켜기 전에 알려 주세요. 처리방침 OpenAI 항목을 고쳐야 합니다.

---

## 3. 배포할 때 넣을 환경 변수

| 변수 | 필수 | 값 |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase 대시보드 → Connect → **pooler** 연결 문자열 (서버리스 환경용) |
| `BETTER_AUTH_SECRET` | ✅ | 32바이트 이상 무작위 문자열 (예: `openssl rand -hex 32` 결과) |
| `BETTER_AUTH_URL` | ✅ | 앱 공개 주소 (예: `https://actionbox.vercel.app`) |
| `GEMINI_API_KEY` | 선택 | Google AI Studio 키. 넣으면 AI 분석을 Google이 먼저 맡음 ([키 발급](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | 선택 | 기본 `gemini-3.5-flash-lite` |
| `OPENAI_API_KEY` | 선택 | Google이 실패하거나 한도를 넘으면 대신 분석 |
| `AI_MODEL` | 선택 | OpenAI 모델, 기본 `gpt-4.1-mini` |
| `AI_DAILY_LIMIT` | 선택 | 기본 50 |
| `GOOGLE_CLIENT_ID` | 선택 | 넣으면 Google 로그인 버튼이 켜짐 (아래 3-1) |
| `GOOGLE_CLIENT_SECRET` | 선택 | 위와 한 쌍 |

- `npm run build`는 `DATABASE_URL`이 있으면 `migrations/*.sql`을 DB에 적용합니다.
- ⚠️ `site.ts`의 `databaseRegion: "대한민국"`은 **Supabase 프로젝트를 서울 리전으로 만들 때만** 사실입니다. 다른 리전이나 서비스를 쓰면 `site.ts`를 고쳐야 합니다.

### 3-1. Google 로그인 켜기 (무료)

1. ⬜ [Google Cloud 콘솔](https://console.cloud.google.com/)에서 프로젝트 만들기 (이름 예: ActionBox)
2. ⬜ [Google 인증 플랫폼](https://console.cloud.google.com/auth/overview) → 시작하기
   - 앱 이름 `ActionBox`, 사용자 지원 이메일, 대상 **외부**, 개발자 연락처 이메일 입력
3. ⬜ [클라이언트](https://console.cloud.google.com/auth/clients) → 클라이언트 만들기 → 유형 **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://actionbox.vercel.app`
   - 승인된 리디렉션 URI: `https://actionbox.vercel.app/api/auth/callback/google`
4. ⬜ 만들어진 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 Vercel → Settings → Environment Variables에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`으로 넣고 Redeploy
5. ⬜ [대상](https://console.cloud.google.com/auth/audience)에서 **앱 게시**(프로덕션으로 전환)
   - 테스트 상태에서는 테스트 사용자로 등록한 계정만 로그인할 수 있습니다.
   - 이 앱은 민감하지 않은 기본 정보(openid·이메일·프로필)만 요청하므로 Google 앱 인증(심사) 없이 게시할 수 있습니다. 다만 로그인 화면에 앱 이름·로고를 보이게 하려면 브랜드 확인이 필요할 수 있습니다.
6. ⬜ [브랜딩](https://console.cloud.google.com/auth/branding)에 앱 홈페이지 `https://actionbox.vercel.app`, 개인정보처리방침 `/privacy`, 서비스 약관 `/terms` 주소 입력

- 앱 주소(도메인)가 바뀌면 3번의 원본·리디렉션 URI와 `BETTER_AUTH_URL`을 함께 바꿔야 합니다.
- Play 앱은 PWABuilder의 TWA(Chrome으로 여는 방식)로 포장하므로 Google 로그인이 됩니다. WebView 방식으로 포장하면 Google이 로그인을 막으니 그 방식은 쓰지 마세요.

---

## 4. Google Play 출시 순서 (웹앱을 TWA로 포장)

1. ⬜ 배포해서 HTTPS 주소 확보 (3장)
2. ⬜ [Play Console](https://play.google.com/console) 개발자 계정 등록 (25달러)
   - **개인 계정**(2023-11-13 이후 생성): 정식 출시 전에 **테스터 12명이 14일 이상** 비공개 테스트에 참여해야 함
   - **조직 계정**(D-U-N-S 번호 필요)은 이 요건이 면제. 미소테크가 사업자라면 검토할 만함
3. ⬜ [PWABuilder](https://www.pwabuilder.com)에 앱 주소를 넣고 Android 패키지(.aab) 생성
   - ‘공유 → ActionBox’는 설치한 앱에서만 공유 목록에 나옵니다. ⚠️ 확인 필요: 패키지를 만들 때 PWABuilder가 매니페스트의 `share_target`을 가져오는지(공유 대상 설정) 확인하세요.
   - Play 출시 전에는 안드로이드 크롬에서 사이트를 연 뒤 메뉴 → **앱 설치**로 설치하면 공유 기능을 미리 시험할 수 있습니다.
4. ⬜ PWABuilder가 주는 `assetlinks.json`을 받으면 저에게 주세요 → `public/.well-known/assetlinks.json`으로 넣겠습니다
   - 이 파일이 없거나 틀리면 앱 위에 브라우저 주소창이 보입니다
5. ⬜ Play Console 입력
   - 개인정보 처리방침 URL: `https://<주소>/privacy`
   - 계정 삭제 URL: `https://<주소>/delete-account`
   - 스토어 등록정보의 웹사이트(문의): `https://<주소>/contact`, 이메일: `rdx840021@gmail.com`
   - 데이터 보안 양식: 처리방침 2항(수집 항목, Google 로그인 항목 포함)과 일치시키기

---

## 5. 남은 일 / 알려진 한계

- ⬜ **Grok 전용 파일 삭제 (권한 필요):** 연결은 끊었지만 파일은 남아 있습니다.
  - `src/lib/app-data/`, `src/lib/env.server.ts`, `src/lib/preview-host-bridge.ts`, `src/lib/preview-embedder-origin.ts`, `src/components/preview-host-bridge.tsx`
  - `src/lib/auth/{providers,preview,popup.server,gate-identity.server,gate-identity.test,gate-session.server,gate-session-marker}.ts`
  - `server/`, `public/__grok/`, `scripts/grok-pwa-plugin.mjs`, `scripts/grok-pwa-plugin.test.mjs`, `scripts/install-page.html`
  - 삭제 후 `tsconfig.json`의 임시 `exclude` 한 줄도 지웁니다.
- **사진을 DB에 저장합니다.** Supabase 무료 500MB는 사진이 많아지면 빨리 찹니다. 사용자가 늘면 사진을 Storage로 옮기는 작업이 필요합니다.
- **가입 이메일 인증이 없습니다.** 메일 서비스를 연결하면 켤 수 있습니다.
- **같은 이메일로 이메일 가입과 Google 로그인을 섞어 쓸 수 없습니다.** 이메일 인증이 없어서, 남이 먼저 가입해 둔 이메일 계정에 Google 로그인이 붙지 않도록 막아 두었습니다. 이 경우 “이미 이메일로 가입돼 있어요” 안내가 나옵니다. 메일 서비스를 연결해 이메일 인증을 켜면 풀 수 있습니다.
- **알림 시각 지정·휴대폰 푸시 알림은 없습니다.** 알림은 날짜 단위로 홈 ‘지금 할 것’에만 표시됩니다. 운영자 결정: 네이티브 앱(Expo)으로 옮길 때 폰 자체 알림으로 만듭니다.
- **약관 개정 공지는 직접 해야 합니다.** 약관상 적용 7일 전(불리한 변경은 30일 전) 공지해야 합니다.
- 다른 기기 로그아웃은 최대 5분 늦을 수 있습니다(로그인 캐시).
- 사업자등록번호와 주소는 입력하지 않았습니다(선택 항목).

---

## 6. 약관·처리방침을 바꿀 때

1. `src/routes/terms.tsx` 또는 `src/routes/privacy.tsx` 수정
2. `src/lib/site.ts`의 `termsVersion` / `privacyVersion`을 새 시행일로 변경
3. 배포 → 로그인 사용자는 다음 방문 때 `/agree`에서 다시 동의
4. 외부 서비스(DB·AI·호스팅)를 바꾸면 `site.ts`의 해당 값과 처리방침 6항도 함께 수정

---

## 7. 광고를 넣게 되면 (아직 코드 없음)

- **ATT는 필요 없습니다.** ATT(App Tracking Transparency)는 Apple iOS의 추적 허용 팝업입니다. Google Play(Android)에는 해당하지 않습니다. 나중에 App Store에 낼 때 필요합니다.
- 대신 Android·Play에서 할 일
  - Play Console → 앱 콘텐츠 → **광고 포함 여부** 신고
  - **데이터 보안 양식**에 광고 업체가 수집하는 정보(기기 식별자 등) 추가
  - **개인정보 처리방침** 수정: 지금 10항은 “광고·행태 분석 쿠키를 쓰지 않는다”고 되어 있으므로 광고를 켜기 전에 반드시 바꾸고 `privacyVersion`을 올려야 함
  - 유럽(EEA)·영국 사용자에게 맞춤 광고를 보이면 Google 인증 동의 관리 도구(CMP)로 동의를 받아야 함. 한국만 배포하면 해당 없음
- ⚠️ 확인 필요: 이 앱은 웹앱을 포장(TWA)하는 방식이라 AdMob(네이티브 앱용)이 아니라 웹 광고(AdSense 등)를 써야 할 가능성이 큽니다. 포장 앱 안의 웹 광고가 허용되는지는 광고를 넣기 전에 해당 광고 정책을 확인해야 합니다.
