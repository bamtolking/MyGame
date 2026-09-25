# 🐿️ 미어캣 — AI 자세 분석 · 맞춤 교정 운동 코치

> **거북이에서 미어캣으로.**
> 정면·옆모습 사진 두 장이면 AI가 체형을 분석하고, 물리치료사가 설계한 교정 운동을 매일 처방하는 앱.

- 📸 **30초 AI 체형 스캔**: 휴대폰을 세워 두고 음성 안내에 맞춰 서 있으면 자동 촬영
  (앨범 사진도 가능). 거북목 각도, 라운드숄더, 등·허리 곡선, 어깨·골반 높이, X/O다리 등 **12가지 지표**를 측정해요.
- 🐢🦐🦆🦩 **체형 동물 유형 + 자세 나이**: “모니터 속 거북이형”, “거북새우형”처럼 한눈에 이해되는 결과.
  SNS에 올리기 좋은 **결과 카드**(사진은 들어가지 않음)도 만들 수 있어요.
- 🧑‍⚕️ **물리치료사 설계 처방**: 호흡 → 풀기 → 늘리기 → 움직이기 → 깨우기 → 통합 순서로
  매일 5·10·15분 루틴을 새로 짜 줘요. 운동 48종, 한국어·영어.
- 🎙️ **운동 플레이어**: 3D 시범 애니메이션, 음성 코칭, 세트·휴식 자동 진행.
  일부 동작은 **AI 카메라 코치**가 횟수를 세고 자세를 봐 줘요.
- 🛡️ **안전 장치**: 응급·위험 신호 체크, 통증 부위·강도에 따른 동작 제외, 운동 후 통증 변화 확인.
- 📈 **변화 기록**: 자세 점수 그래프, 전후 비교, 연속 운동 일수, 통증 추이.
- 💼 **사무실 1분 리셋**과 근무 시간 알림.
- 🔒 **모든 분석이 기기 안에서**: 회원가입·서버 없음, 사진은 휴대폰 밖으로 나가지 않아요.

## 바로 써 보기

### 1) 안드로이드 폰에 설치 (APK)
이 폴더가 GitHub에 올라갈 때마다 **자동으로 APK가 만들어져요.**
1. GitHub 저장소 → **Actions** 탭 → `Meerkat Android APK` → 가장 최근 실행(✅) 클릭
2. 아래쪽 **Artifacts** 의 `meerkat-debug-apk` 를 내려받아 압축을 풀고 폰으로 옮겨 설치
   (설정에서 “출처를 알 수 없는 앱 설치”를 허용해야 해요)

### 2) PC에서 개발 서버로 (휴대폰 브라우저로 접속)
Node.js 22 설치 후:
```bash
cd meerkat
npm install
npm run dev          # 터미널에 나오는 http://<PC IP>:5173 을 같은 Wi-Fi 휴대폰으로 열기
```
> 카메라는 보안 연결(https)이나 localhost에서만 켜져요. 휴대폰에서 카메라까지 쓰려면
> APK로 설치하거나 https로 배포(예: Netlify/Vercel에 `dist/` 올리기)해서 여세요.
> http 주소로 열면 **앨범 사진 불러오기**로 분석할 수 있어요.

### 3) 아이폰
Mac + Xcode가 필요해요. `npm run ios` → Xcode에서 실행. 자세한 건 [출시 가이드](docs/RELEASE.md).

## 문서
| 문서 | 내용 |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | 왜 이 앱인가 · 시장 · 바이럴/리텐션 구조 · 수익 모델 · 로드맵 |
| [docs/STORE_LISTING.md](docs/STORE_LISTING.md) | 스토어 등록 문구(한/영) · 키워드 · 스크린샷 구성 · 개인정보 라벨 |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | **전문가용**: 운동·기준값·문구 수정 방법, 검토 체크리스트 |
| [docs/RELEASE.md](docs/RELEASE.md) | 구글 플레이 · 앱스토어 출시 절차 |

## 구조
```
src/analysis/   자세 분석 엔진 (정면·측면 지표, 실루엣 곡선, 점수·자세 나이·동물 유형)
  norms.ts      ← 판정 기준값(임계값·가중치)은 전부 이 파일 하나에
src/pose/       MediaPipe 온디바이스 포즈 인식, 카메라
src/content/    운동 라이브러리(48종), 체형 유형·지표 설명, 팁
src/routine/    맞춤 루틴 처방기 (이슈 가중치 → 교정 순서 → 시간 맞춤, 안전 필터)
src/coach/      AI 카메라 코치 (횟수 세기·버티기 판정)
src/figure/     3D 인체 리그 + Canvas 운동 시범 애니메이션
src/screens/    화면 16개 (온보딩·홈·스캔·리포트·공유·플레이어·운동·기록·통증·안전·설정…)
src/share/      공유 카드 이미지 생성
public/models/  포즈 모델 (lite: 실시간 코칭, full: 정밀 스캔)
android/ ios/   Capacitor 네이티브 프로젝트
tests/          단위 테스트 51개 (분석·처방·코칭·콘텐츠 무결성)
scripts/        e2e(휴대폰 화면 실기동 스크린샷), 아이콘 생성
```

## 명령
```bash
npm run dev        # 개발 서버
npm test           # 단위 테스트 (1초)
npm run build      # 타입검사 + 프로덕션 빌드 → dist/
npm run e2e        # 빌드본을 헤드리스 크롬(휴대폰 크기)으로 돌려 보고 e2e-out/ 에 스크린샷
npm run icons      # 앱 아이콘·스플래시 다시 생성
npm run android    # 빌드 → 안드로이드 스튜디오 열기
npm run ios        # 빌드 → Xcode 열기
```

## 기술
Preact + TypeScript + Vite · MediaPipe Tasks Vision(Pose Landmarker, 온디바이스·GPU) ·
Capacitor 8(안드로이드/iOS) · Pretendard · Lucide · Vitest · Playwright.
서버·외부 API·광고 SDK 없음.

---
⚠️ 미어캣은 건강한 성인의 자세 관리를 돕는 **웰니스 앱**이며 의료기기가 아닙니다. 진단·치료를 대신하지 않아요.
