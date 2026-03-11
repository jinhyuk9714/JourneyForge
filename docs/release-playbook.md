# JourneyForge 릴리스 런북

JourneyForge의 공식 macOS 릴리스 경로는 `v*` 태그를 푸시해서 GitHub Actions `macOS Release` workflow를 실행하는 방식입니다. 현재 검증된 기준선은 `v0.1.3`입니다.

## 필수 준비물

GitHub repository `Secrets`

- `BUILD_CERTIFICATE_BASE64`
- `P12_PASSWORD`
- `APPLE_API_KEY_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

GitHub repository `Variables` 또는 `Secrets`

- `CSC_NAME`

버전 계약

- `apps/desktop/package.json`의 `version` 값과 릴리스 태그 `vX.Y.Z`는 반드시 일치해야 합니다
- workflow는 tag와 desktop version이 다르면 fail-fast 합니다

## 표준 릴리스 절차

1. `apps/desktop/package.json` 버전을 다음 릴리스 버전으로 올립니다
2. 같은 버전을 루트 `package.json`, `packages/core/package.json`, `packages/shared/package.json`에도 맞춥니다
3. `main`에 변경을 푸시합니다
4. 태그를 발행합니다

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. GitHub Actions `macOS Release` run이 성공하는지 확인합니다
6. GitHub Release에 아래 산출물이 첨부됐는지 확인합니다
   - `.dmg`
   - `.zip`
   - 가능하면 `.blockmap`
7. Release notes를 검토합니다
8. Release에서 `.dmg`를 내려받아 Gatekeeper 첫 실행 경험을 한 번 수동 확인합니다

## 로컬 수동 fallback

CI가 막혔을 때는 개발자 Mac에서 아래 경로를 사용합니다.

```bash
pnpm --filter @journeyforge/desktop package:mac
pnpm --filter @journeyforge/desktop notarize:mac:verify
```

이 경로는 아래를 모두 포함합니다.

- signed `.app`
- notarized `.app`
- stapled `.dmg`
- `codesign`, `stapler`, `spctl` 검증
- packaged startup smoke

## 릴리스 체크리스트

릴리스 전

- `apps/desktop/package.json` version과 발행할 `vX.Y.Z` 태그가 일치한다
- GitHub Secrets/Variables가 모두 존재한다
- `main`이 릴리스 대상 커밋을 가리킨다

릴리스 중

- `macOS Release` workflow가 성공한다
- signing certificate import 단계가 통과한다
- ASC API key materialization 단계가 통과한다
- repository verification, packaging, notarization, artifact publish가 모두 통과한다

릴리스 후

- GitHub Release에 `.dmg`와 `.zip`가 첨부돼 있다
- Release notes를 확인했다
- Gatekeeper 다운로드/실행 확인을 마쳤다

## 실패 분류와 1차 대응

인증서 import 실패

- `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `CSC_NAME` 값을 먼저 확인합니다
- `.p12` export 비밀번호와 GitHub secret 값이 일치하는지 다시 봅니다

ASC API key 실패

- `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`를 다시 확인합니다
- `.p8` 파일 base64가 손상되지 않았는지 확인합니다

Playwright browser 미설치

- workflow에 `Install Playwright Chromium for repository verification` step이 있는지 확인합니다
- `pnpm install:browsers`가 repository verification 전에 실행되는지 확인합니다

k6 미설치

- workflow에 `Install k6 for repository verification` step이 있는지 확인합니다
- GitHub-hosted macOS runner에서 `brew install k6`가 실행되는지 확인합니다

notarization / stapler / spctl 실패

- 먼저 `package:mac` 단계와 `notarize:mac:verify` 단계 중 어디서 깨졌는지 확인합니다
- notarization submit 실패면 Apple 자격증명과 ASC API key를 우선 점검합니다
- `stapler` 또는 `spctl` 실패면 release 산출물이 최신 run에서 생성된 것인지 확인합니다

GitHub Release 첨부 실패

- workflow가 `.dmg`와 `.zip`를 실제로 생성했는지 먼저 확인합니다
- 같은 태그의 기존 Release가 있으면 upload 단계가 `--clobber`로 덮어쓰는지 확인합니다
