# 스토어 출시 가이드

이 게임은 웹 기술(HTML5 + TypeScript)로 만들었습니다. 스토어에 올리려면 **Capacitor**로 감싸 안드로이드/iOS 앱으로 만듭니다. 게임 코드는 그대로 두고, 기기 기능(진동, 공유)만 `src/platform/`에서 바꾸면 됩니다.

> 도구와 스토어 정책은 자주 바뀝니다. 아래 명령과 조건은 작성 시점 기준이니, 막히면 각 공식 문서와 콘솔 안내를 우선하세요.

## 0. 준비물

| 항목 | 안드로이드 | iOS |
|---|---|---|
| 개발자 계정 | Google Play Console (1회 등록비) | Apple Developer Program (연회비) |
| 개발 도구 | Android Studio (Windows/Mac/Linux) | **Mac + Xcode 필수** |
| 서명 | 업로드 키 (Android Studio에서 생성) | 인증서·프로비저닝 (Xcode 자동 서명) |
| 공통 | 개인정보처리방침 공개 URL (`docs/PRIVACY.md`를 GitHub Pages 등에 게시), 지원 이메일 |

## 1. 웹 빌드 확인

```bash
cd nyang
npm install
npm test          # 모두 통과해야 함
npm run build     # dist/ 생성
npm run e2e       # 선택: 헤드리스 브라우저로 화면 흐름 확인
```

## 2. Capacitor로 앱 만들기

`capacitor.config.json`은 이미 들어 있습니다. **`appId`를 본인 도메인 기준으로 바꾸세요** (예: `com.yourname.nyangche`). 한 번 스토어에 올리면 바꿀 수 없습니다.

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm i @capacitor/haptics @capacitor/share     # 진동·공유를 네이티브로
npx cap add android
npx cap add ios                                # Mac에서
npm run build && npx cap sync                  # 웹 빌드가 바뀔 때마다
npx cap open android                           # Android Studio 열기
npx cap open ios                               # Xcode 열기
```

### 앱에서 꼭 바꿀 것

1. **화면 방향 세로 고정**
   - 안드로이드: `android/app/src/main/AndroidManifest.xml`의 `<activity>`에 `android:screenOrientation="portrait"`
   - iOS: Xcode → 타깃 → General → Device Orientation에서 Portrait만 선택
2. **진동**: iOS 웹뷰는 `navigator.vibrate`를 지원하지 않습니다. `src/platform/share.ts`의 `vibrate()` 한 곳만 `@capacitor/haptics`(`Haptics.impact`)로 바꾸면 됩니다.
3. **공유**: `shareText()`에서 `@capacitor/share`의 `Share.share({ text, files })`를 먼저 쓰도록 바꾸면 결과 카드 이미지까지 공유됩니다.
4. **공유 링크**: 스토어 주소가 생기면 `src/platform/share.ts`의 `SHARE_URL`에 넣습니다. 공유 문구 끝에 붙습니다.
5. **아이콘·스플래시**: `store/icon-1024.png`를 `assets/icon-only.png`로 복사하고 `npx @capacitor/assets generate --iconBackgroundColor "#FFD9BE" --splashBackgroundColor "#FFD9BE"` (도구 옵션은 버전마다 조금 다를 수 있음).
6. **서비스 워커**: 앱 안에서는 자동으로 꺼집니다 (`src/main.ts`에서 Capacitor 감지).

### 릴리스 빌드

- 안드로이드: Android Studio → Build → Generate Signed Bundle → **AAB** 파일. `targetSdkVersion`은 Play Console이 요구하는 최신 값으로.
- iOS: Xcode → Product → Archive → Distribute App → App Store Connect 업로드.

## 3. 구글 플레이 등록

1. Play Console → 앱 만들기 (게임, 무료).
2. **스토어 등록정보**: `docs/STORE_LISTING.md`의 제목·짧은 설명·자세한 설명.
3. **그래픽**: 아이콘 `store/icon-512-play.png`, 그래픽 이미지 `store/feature-1024x500-ko.png`(영어는 `-en`), 휴대폰 스크린샷 `store/screenshots/ko/play-*.jpg` (1080×1920, 6장).
4. **앱 콘텐츠**
   - 개인정보처리방침 URL
   - 데이터 보안: 이 버전은 **수집·공유하는 데이터 없음** (저장은 기기 안에만). 광고나 분석 도구를 넣으면 다시 작성해야 합니다.
   - 콘텐츠 등급 설문: 폭력·도박·채팅 없음 → 전체이용가 수준.
   - 타깃 연령: 13세 미만을 포함하면 가족 정책(광고 SDK 제한 등)이 적용됩니다. 처음에는 13세 이상으로 두는 것이 간단합니다.
5. **테스트 트랙**: 2023년 이후 만든 개인 개발자 계정은 프로덕션 출시 전에 **비공개 테스트를 일정 인원(최근 기준 12명) 이상, 14일 이상** 돌려야 합니다. 콘솔의 현재 조건을 확인하세요.
6. 프로덕션 출시 → 심사 (보통 며칠).

## 4. 앱스토어 등록

1. App Store Connect → 새 앱 (번들 ID = `appId`).
2. **스크린샷**: `store/screenshots/ko/ios67-*.jpg` (1290×2796). 제출 시점에 필요한 기기 크기를 확인하세요.
3. **앱 개인정보**: "데이터를 수집하지 않음".
4. **연령 등급**: 4+.
5. **심사 주의 (가이드라인 4.2 최소 기능)**: 웹사이트를 감싸기만 한 앱은 거절될 수 있습니다. 이 게임은 오프라인으로 완전히 돌아가는 게임이라 해당 가능성은 낮지만, 네이티브 진동(Haptics)과 Game Center 순위표를 넣으면 더 안전합니다.
6. 심사 제출.

## 5. (선택) 광고와 결제

- 보상형 광고: AdMob + 커뮤니티 Capacitor 플러그인. 넣을 자리는 집사 찬스(`showRevive`)와 능력 충전(`noCharge`) — [기획서](GAME_DESIGN.md#수익화-계획-이-버전에는-넣지-않음) 참고.
- 광고를 넣으면: 유럽 사용자 동의(UMP), iOS 추적 권한(ATT), 플레이 데이터 보안 양식과 앱스토어 개인정보 라벨을 모두 다시 작성해야 합니다.
- 광고 제거 결제: 인앱 결제 플러그인 (RevenueCat 등).

## 6. 출시 전 체크리스트

- [ ] `appId` 변경, 앱 이름 확정 (한국: 냥체역학 / 영어: Cats Are Liquid)
- [ ] 실제 안드로이드 폰, 아이폰에서 한 판 끝까지 (소리, 진동, 이어하기, 공유)
- [ ] 저사양 안드로이드에서 고양이 30마리 이상일 때 프레임 확인 (느리면 설정의 "효과 줄이기")
- [ ] 개인정보처리방침 URL 게시
- [ ] `SHARE_URL` 입력
- [ ] 스토어 문구의 이메일/연락처 채우기
- [ ] 버전 번호: `package.json`의 `version`, `src/ui/app.ts`의 `VERSION`

## 7. 출시 후

- 숏폼 영상: 액체화 연쇄, 우주뚱냥 승천, 넘치기 직전 장면 (화면 녹화로 충분).
- 오늘의 상자 공유 문구를 고양이 커뮤니티에 올리기 좋게 다듬기.
- 사람 플레이 기록을 보고 `src/data/rules.ts` 수치 조정 → `npm run balance`로 확인.
