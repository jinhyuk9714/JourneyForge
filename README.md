# JourneyForge

JourneyForge는 실제 브라우저 여정을 개발 자산으로 바꾸는 로컬 우선 도구입니다.

한 번 기록하면 다음 산출물을 생성합니다.

- Playwright E2E 테스트 초안
- API 흐름 문서
- k6 부하 테스트 초안

## 워크스페이스 구성

- `apps/desktop`: Electron + React 기반 데스크톱 앱
- `packages/shared`: 공용 도메인 타입과 유틸리티
- `packages/core`: recorder, normalizer, generator, JSON 저장 오케스트레이션

## 자주 쓰는 명령

```bash
pnpm install
pnpm approve-builds
pnpm --filter @journeyforge/desktop exec node node_modules/electron/install.js
pnpm install:browsers
pnpm dev
pnpm demo-target
pnpm smoke
pnpm --filter @journeyforge/desktop test:e2e
pnpm --filter @journeyforge/desktop test:smoke-real
pnpm --filter @journeyforge/desktop test:smoke-execution-real
pnpm --filter @journeyforge/desktop test:package-smoke
pnpm --filter @journeyforge/desktop test:package-smoke:signed
pnpm --filter @journeyforge/desktop package:mac
pnpm --filter @journeyforge/desktop notarize:mac:verify
pnpm test
pnpm build
```

## MVP 기준점

- Chromium 녹화 세션은 한 번에 하나만 지원합니다
- 데이터는 기본적으로 `data/` 아래에 JSON으로 저장합니다
- 녹화 세션 1개는 정규화된 여정 1개를 만듭니다
- 설정은 `data/settings.json`에 저장됩니다
- 저장된 설정은 저장 완료 이후 시작하는 새 녹화부터 적용됩니다
- 실행 가능한 번들이 준비되면 Playwright와 k6를 데스크톱 앱 안에서 바로 실행할 수 있습니다
- 실행용 이메일과 base URL은 설정에 저장되고, Playwright 비밀번호는 운영체제 키체인에 저장됩니다

## 데모 타깃

- `apps/demo-target`은 real-browser smoke 검증에 쓰는 인-레포 대상 앱입니다
- 수동 실행은 `pnpm demo-target`으로 시작합니다
- 기본 happy path는 `login -> search -> detail`, `create post`, `edit post`입니다

## 네이티브 런타임 준비

- pnpm이 네이티브 빌드 스크립트를 막았다고 나오면 `pnpm approve-builds`를 실행하고 `keytar`를 승인하세요
- fresh worktree에서 Electron 바이너리 다운로드가 빠졌다면 `pnpm --filter @journeyforge/desktop exec node node_modules/electron/install.js`로 복구할 수 있습니다
- Playwright 실행 중 키체인 로드 오류가 나면 desktop 패키지의 네이티브 모듈을 다시 빌드한 뒤 재시도하세요

## 서명된 macOS 릴리스

- `pnpm --filter @journeyforge/desktop package:mac`는 공식 signed release 경로이며 `apps/desktop/release` 아래에 서명된 `.dmg`와 `.zip`을 생성합니다
- signed packaging 흐름은 `electron-builder`로 앱을 서명하고 notarization한 뒤, 생성된 DMG를 `notarytool`로 한 번 더 제출하고 staple까지 수행합니다
- `pnpm --filter @journeyforge/desktop package:mac:unsigned`와 `pnpm --filter @journeyforge/desktop package:mac:dir:unsigned`는 개발자 전용 fallback으로 남겨 둡니다
- `pnpm --filter @journeyforge/desktop notarize:mac:verify`는 signed artifact에 대해 `codesign`, `stapler`, `spctl`, packaged startup smoke를 순서대로 검증합니다
- signed release를 만들기 전 아래 환경변수를 준비하세요
  - signing: `CSC_NAME` 또는 `CSC_LINK`
  - App Store Connect API key 기반 notarization: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  - Apple ID 기반 notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  - keychain profile 기반 notarization: `APPLE_KEYCHAIN_PROFILE`와 선택적 `APPLE_KEYCHAIN`
- 패키징 전에 Developer ID 인증서를 로그인 키체인에 추가해야 합니다. `security find-identity -v -p codesigning`에서 `Developer ID Application` 항목이 보여야 합니다
- `pnpm --filter @journeyforge/desktop test:package-smoke`는 빠른 로컬 검증용으로 unsigned unpacked `.app`를 사용합니다
- packaged app은 repo 루트의 `data/`를 쓰지 않고 Electron `userData` 아래에 같은 `data/` 구조를 만듭니다
- 첫 설정 저장이나 세션 생성 이후 `settings.json`, 세션 데이터, export 결과가 그 경로에 쌓입니다
- Playwright, k6, 키체인 동작은 계속 로컬 머신의 toolchain과 macOS keychain에 의존합니다

## CI macOS 릴리스 준비

- `.github/workflows/macos-release.yml`이 공식 GitHub Actions 릴리스 경로입니다
- workflow는 `v*` 태그 push와 `workflow_dispatch`를 지원합니다
- 활성화 전에 아래 GitHub repository secrets를 준비하세요
  - `BUILD_CERTIFICATE_BASE64`
  - `P12_PASSWORD`
  - `APPLE_API_KEY_BASE64`
  - `APPLE_API_KEY_ID`
  - `APPLE_API_ISSUER`
- `CSC_NAME`은 repository variable 또는 secret으로 설정합니다
- workflow는 패키징 전에 태그 버전과 `apps/desktop/package.json` 버전이 일치하는지 먼저 검증합니다
- 태그 기반 릴리스는 signed/notarized `.dmg`, `.zip`, 그리고 가능한 경우 `.blockmap`까지 GitHub Release에 첨부합니다

## 실제 브라우저 검증

- `pnpm smoke`는 실제 Chromium으로 `record -> normalize -> generate -> export` 흐름을 검증합니다
- Playwright 브라우저가 아직 설치되지 않았다면 `pnpm install:browsers`를 먼저 실행하세요
- smoke target은 JourneyForge 자체를 검증하기 위한 최소 대상 앱입니다

## 데스크톱 UI 자동화

- `pnpm --filter @journeyforge/desktop test:e2e`는 fake runtime으로 빌드된 Electron 앱 셸을 end-to-end 검증합니다
- 포함 시나리오는 `default`, `legacy`, `cancel-execution`입니다
- 녹화 상태 전이, preview 렌더링, explainability 카드, artifact/bundle export 메시지, in-app execution 로그를 함께 확인합니다

## 실제 데스크톱 smoke

- `pnpm --filter @journeyforge/desktop test:smoke-real`는 실제 desktop runtime으로 빌드된 Electron 앱을 띄웁니다
- test-only autopilot이 headless Chromium을 조작해서 `record -> normalize -> generate -> preview -> export`를 검증합니다
- 포함 시나리오는 `login-search-detail`과 `create-post`입니다

## 실제 로컬 실행 smoke

- `pnpm --filter @journeyforge/desktop test:smoke-execution-real`는 실제 execution service를 붙인 Electron 앱을 띄웁니다
- `login -> search -> detail`을 녹화한 뒤 Electron 안에서 생성된 Playwright/k6 번들을 실제 로컬 toolchain으로 실행합니다
- `k6`는 미리 설치되어 있어야 하며, 로컬 `PATH`에서 찾을 수 있어야 합니다

## Packaged App Smoke

- `pnpm --filter @journeyforge/desktop test:package-smoke`는 빌드 산출물이 아니라 release `.app` executable 자체를 실행합니다
- packaged renderer/main/preload bootstrap과 Electron `userData/data` 아래의 persistence 초기화를 확인합니다

## 수동 검증 체크리스트

### 키체인 비밀번호 루프

dev runtime 키체인 루프는 2026년 3월 11일에 수동 검증을 완료했습니다.

1. `pnpm dev` 실행
2. `설정` 화면 열기
3. Playwright 비밀번호를 입력하고 `비밀번호 저장/교체` 클릭
4. 상태가 `Playwright 비밀번호가 설정되어 있습니다`로 바뀌는지 확인
5. 다른 비밀번호를 입력하고 다시 `비밀번호 저장/교체` 클릭
6. 앱을 종료했다가 다시 열고, macOS keychain 상태와 `configured` 상태가 계속 일치하는지 확인
7. `비밀번호 삭제` 클릭
8. 상태가 `Playwright 비밀번호가 설정되지 않았습니다`로 바뀌는지 확인
9. 앱을 다시 종료/재실행해서 해제 상태가 유지되는지 확인

### Packaged App 키체인 루프

packaged app 키체인 루프는 2026년 3월 11일에 수동 검증을 완료했습니다.

1. 빠른 로컬 검증은 `pnpm --filter @journeyforge/desktop package:mac:unsigned`, signed release 경로는 `pnpm --filter @journeyforge/desktop package:mac` 실행
2. packaged `.app` 실행
3. `설정` 화면에서 저장, 교체, 삭제, 재실행 루프를 dev 앱과 동일하게 반복
4. packaged 앱 재시작 이후에도 credential 상태가 macOS keychain과 계속 일치하는지 확인

### Signed Release 검증

1. signing / notarization 환경변수 준비
2. `pnpm --filter @journeyforge/desktop package:mac` 실행
3. `apps/desktop/release` 아래에 `.dmg`와 `.zip`이 생성되는지 확인
4. `pnpm --filter @journeyforge/desktop notarize:mac:verify` 실행
5. signed/notarized `.app`과 stapled `.dmg`가 `codesign`, `stapler`, `spctl`을 통과하는지 확인

## 현재 제한 사항

- signed/notarized 릴리스가 자동 배포되더라도, 릴리스 노트 정리와 설치 경험 다듬기 같은 운영 마무리는 여전히 수동으로 관리합니다
