# JourneyForge

JourneyForge는 브라우저에서 직접 수행한 흐름을 기록해 테스트, 문서, 성능 검증 초안으로 바꿔 주는 macOS 데스크톱 앱입니다.

- Playwright E2E 테스트 초안 생성
- API 흐름 문서 생성
- k6 부하 테스트 초안 생성
- 앱 안에서 Playwright와 k6 실행

## 이 앱이 하는 일

로그인, 검색, 상세 진입, 생성, 수정 같은 웹 흐름을 한 번 직접 수행하면 JourneyForge가 그 과정을 정리해 아래 결과물로 바꿉니다.

- 브라우저 행동을 재현하는 Playwright 테스트
- 어떤 단계에서 어떤 API가 호출됐는지 보여 주는 흐름 문서
- 실제 호출된 핵심 API를 바탕으로 만든 k6 스크립트 초안

핵심은 간단합니다. 같은 흐름을 다시 손으로 정리하지 않아도 된다는 점입니다.

## 이런 사람에게 맞습니다

- 화면 동선을 테스트 코드로 빠르게 남기고 싶은 프론트엔드 개발자
- 실제 사용자 흐름에서 어떤 API가 호출되는지 보고 싶은 백엔드 개발자
- 기능 검증과 성능 검증의 출발점을 빨리 만들고 싶은 QA와 팀 리드

## 빠르게 시작하기

### 1. 설치

```bash
pnpm install
pnpm approve-builds
pnpm --filter @journeyforge/desktop exec node node_modules/electron/install.js
pnpm install:browsers
```

`pnpm approve-builds`에서는 `keytar`를 허용해야 합니다.

### 2. 앱 실행

```bash
pnpm dev
```

### 3. 데모 타깃으로 바로 써보기

별도 터미널에서:

```bash
pnpm demo-target
```

그다음 앱에서 아래 주소를 입력해 녹화를 시작하면 됩니다.

```text
http://127.0.0.1:4173/login
```

## 기본 사용 흐름

1. `설정`에서 Playwright 이메일, 기본 URL, 비밀번호를 먼저 맞춥니다.
2. 홈 화면에서 대상 URL을 입력하고 `기록 시작`을 누릅니다.
3. 열린 Chromium 브라우저에서 실제로 사이트를 사용합니다.
4. 앱으로 돌아와 `기록 종료`를 누릅니다.
5. 생성된 `Playwright`, `Flow Markdown`, `k6` 결과를 확인합니다.
6. 필요하면 내보내거나 앱 안에서 바로 실행합니다.

## 생성 결과는 어떻게 쓰나

### Playwright

- 방금 수행한 흐름을 자동화 테스트로 다시 실행할 수 있습니다.
- 정식 E2E 테스트에 편입하기 전에 초안으로 다듬는 용도로 좋습니다.

### Flow Markdown

- 어떤 행동 뒤에 어떤 API가 호출됐는지 한눈에 볼 수 있습니다.
- 리뷰, 공유, 기능 이해용 문서로 바로 쓸 수 있습니다.

### k6

- 실제 사용자 흐름에 등장한 API를 기준으로 성능 테스트 초안을 만듭니다.
- rate, threshold, payload만 다듬어 실제 부하 테스트로 확장할 수 있습니다.

## 설정과 저장 방식

- 설정은 기본적으로 `data/settings.json`에 저장됩니다.
- Playwright 비밀번호는 파일이 아니라 운영체제 키체인에 저장됩니다.
- 개발 실행 기준 세션과 결과물은 repo의 `data/` 아래에 저장됩니다.
- packaged 앱은 repo 루트가 아니라 Electron `userData/data` 아래에 같은 구조로 저장합니다.

## 자주 쓰는 명령

### 개발

```bash
pnpm dev
pnpm demo-target
pnpm smoke
pnpm build
pnpm test
pnpm check-types
```

### 데스크톱 검증

```bash
pnpm --filter @journeyforge/desktop test:e2e
pnpm --filter @journeyforge/desktop test:smoke-real
pnpm --filter @journeyforge/desktop test:smoke-execution-real
pnpm --filter @journeyforge/desktop test:package-smoke
```

### macOS 패키징

```bash
pnpm --filter @journeyforge/desktop package:mac
pnpm --filter @journeyforge/desktop notarize:mac:verify
pnpm --filter @journeyforge/desktop package:mac:unsigned
pnpm --filter @journeyforge/desktop package:mac:dir:unsigned
```

## 릴리스

공식 릴리스 경로는 `v*` 태그를 push해서 GitHub Actions `macOS Release` workflow를 실행하는 방식입니다.

- 현재 성공 기준선: `v0.1.2`
- 산출물: signed/notarized `.dmg`, `.zip`
- 릴리스 파일 위치: GitHub Release 또는 `apps/desktop/release`

로컬에서 직접 signed 릴리스를 검증해야 할 때는 아래 두 명령을 사용합니다.

```bash
pnpm --filter @journeyforge/desktop package:mac
pnpm --filter @journeyforge/desktop notarize:mac:verify
```

세부 릴리스 절차, GitHub Secrets, 실패 대응은 [docs/release-playbook.md](docs/release-playbook.md)에 정리되어 있습니다.

## 프로젝트 구조

- `apps/desktop`: Electron + React 기반 데스크톱 앱
- `apps/demo-target`: 데모 및 실제 smoke 검증용 대상 앱
- `packages/core`: 녹화, 정규화, 생성, 저장 오케스트레이션
- `packages/shared`: 공용 타입과 유틸리티

## 현재 상태

- 데스크톱 UI와 실행 흐름이 자동 검증되어 있습니다.
- signed/notarized macOS `.app`과 `.dmg`를 만들 수 있습니다.
- GitHub Actions로 macOS 릴리스를 자동 발행할 수 있습니다.

## 현재 제한 사항

- 릴리스 노트 정리와 최종 배포 공지는 여전히 사람이 직접 관리합니다.
- Gatekeeper 설치 경험과 안내 문구 같은 installer polish는 운영 작업으로 남아 있습니다.
