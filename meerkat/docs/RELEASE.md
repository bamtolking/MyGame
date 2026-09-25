# 출시 가이드 (구글 플레이 · 앱스토어)

> 스토어 정책은 자주 바뀌어요. 각 단계에서 콘솔에 표시되는 최신 안내를 우선으로 따르세요.

## 0. 출시 전 공통 준비
1. `capacitor.config.ts` 의 **appId**(예: `com.회사명.meerkat`)를 정하세요. 한 번 올리면 바꿀 수 없어요.
   바꾼 뒤 `npx cap sync` 를 하고, 안드로이드는 `android/app/build.gradle` 의 `applicationId`·`namespace` 도 같은 값으로 맞추세요.
2. `src/config.ts` 의 대표 이름·자격·소개, 공유 카드에 들어갈 주소(`BRAND.url`)를 실제 정보로 바꾸세요.
3. 버전: `package.json` 의 `version`, 안드로이드 `android/app/build.gradle` 의 `versionCode`(정수, 올릴 때마다 +1)·`versionName`,
   iOS는 Xcode의 Version/Build.
4. [STORE_LISTING.md](STORE_LISTING.md) 의 문구·스크린샷 준비.
5. 개인정보 처리방침 페이지(웹 주소) 1장: “수집하는 개인정보 없음, 모든 데이터는 기기에만 저장” 내용.

## 1. 안드로이드 (Google Play)

### 테스트용 APK
- GitHub에 푸시하면 **Actions → Meerkat Android APK → Artifacts** 에서 디버그 APK를 받을 수 있어요.
- 직접 빌드: Android Studio 설치 → `npm run android` → ▶︎ 실행.

### 출시용 서명 키 만들기 (한 번만, 절대 잃어버리면 안 됨)
```bash
keytool -genkey -v -keystore meerkat-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias meerkat
```
- 파일과 비밀번호를 안전한 곳 2군데 이상에 백업하세요. Play 앱 서명(Google이 최종 키 보관)을 쓰면 업로드 키를 잃어도 재설정할 수 있어요.

### 출시용 번들(AAB) 만들기
Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle** → 위 키 선택.
또는 명령줄:
```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease   # 서명 설정 후
# 결과: android/app/build/outputs/bundle/release/app-release.aab
```

### Play Console 절차
1. [Play Console](https://play.google.com/console) 개발자 계정 등록 (일회성 등록비, 본인 인증).
2. **앱 만들기** → 이름·언어(한국어)·무료.
3. **새 개인 계정은 비공개 테스트가 필수**예요: 테스터(현재 정책 기준 최소 12명)가 14일 이상 테스트해야 프로덕션 신청이 가능해요.
   → 대표의 회원·지인에게 테스트 링크를 돌리는 “비공개 테스트”로 시작하세요. (앱 품질 보정에도 좋아요)
4. 필수 설정
   - **데이터 보안**: 수집·공유 없음. 카메라는 기기 내 처리.
   - **콘텐츠 등급** 설문, **타겟층**(만 18세 이상 권장), **광고 없음**.
   - **건강 앱 선언**: 피트니스/웰니스, 의료기기 아님.
   - **권한 설명**: 카메라(자세 분석·운동 코칭), 알림(운동 알림).
5. 스토어 등록정보 입력 → AAB 업로드 → 검토 제출.

## 2. iOS (App Store)
준비물: **Mac + Xcode**, Apple Developer Program 가입(연회비).

```bash
npm install
npm run ios          # 빌드 → Xcode 열림
```
1. Xcode → App 타깃 → **Signing & Capabilities** → Team 선택, Bundle Identifier = appId.
2. 실제 아이폰 연결 → ▶︎ 실행해서 카메라·음성·알림 확인.
3. **Product → Archive** → Distribute App → App Store Connect 업로드.
4. [App Store Connect](https://appstoreconnect.apple.com)에서 앱 생성 → **TestFlight** 로 먼저 테스트.
5. 앱 정보 입력
   - 개인정보 보호 라벨: **Data Not Collected**
   - 카메라 사용 문구는 `ios/App/App/Info.plist` 에 이미 들어 있어요 (NSCameraUsageDescription 등).
   - 심사 메모: [STORE_LISTING.md](STORE_LISTING.md#심사-메모-review-notes) 참고.
6. 심사 포인트: 건강 관련 앱은 **정확성·안전**을 엄격히 봐요(가이드라인 1.4.1).
   “진단/치료” 표현이 없고, 웰니스 앱이라는 안내가 앱 안(소개·리포트)에 있어야 해요 — 이미 반영되어 있어요.

## 3. 웹으로도 배포하기 (선택)
`npm run build` 로 생긴 `dist/` 폴더를 Netlify·Vercel·Cloudflare Pages 같은 정적 호스팅에 올리면
**https 주소 하나로 누구나 휴대폰에서 바로 써 볼 수 있어요** (홈 화면에 추가하면 앱처럼 설치됨, 오프라인 지원).
광고·체험용 랜딩으로 좋아요.

## 4. 인앱 결제 붙일 때 (0.2 계획)
- 추천: RevenueCat(`@revenuecat/purchases-capacitor`) — 구글·애플 결제를 한 코드로.
- 무료/프리미엄 구분 아이디어는 [PRODUCT.md](PRODUCT.md#3-수익-모델) 참고.
