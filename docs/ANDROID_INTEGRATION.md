# Android 백엔드 연동 점검

## 현재 테스트 설정 (2026-09-12)

- 백엔드 담당자가 갱신한 주소 `https://decrease-provinces-graduate-disciplines.trycloudflare.com`을 `src/config/api.ts`의 `SERVER_URL`에 적용했다. 이전 creator-dialog 주소는 HTTP 530 / Cloudflare 1033을 반환해 교체했다. 아래 이전 기록의 로컬 주소/주소 미수신 설명보다 이 설정이 우선한다.
- 에뮬레이터와 실제 Android 기기 모두 이 HTTPS 주소를 사용한다. Quick Tunnel 재시작으로 주소가 바뀌면 같은 설정 한 곳을 수정하고 APK를 다시 빌드한다.
- 사용자 제공 `nunnun-6b062` / `com.nunnun`용 `google-services.json` 적용 완료. Firebase 포함 ZIP에는 `android/app/google-services.json`이 들어 있다.
- 이전 APK 빌드는 최종 성공 기록이 확인되지 않았다. 이 주소가 포함된 APK 빌드·설치와 실제 서버/푸시 통합 테스트는 아직 완료되지 않았다.
- 새 주소에서 눈눈 계정으로 실제 HTTP API 검증을 수행했다. 계정 목록, 데모 로그인, 내 정보, 그룹, 오늘, 기상 목표, 방해금지, 고정 일정, 통계, 로그아웃 총 10개 요청이 모두 HTTP 200이었다. 앱 UI/FCM 테스트와는 별개이며, 실제 기기 등록·푸시·사진 인증은 미검증이다.

## 기준 코드

- 프론트엔드: 사용자가 제공한 `project-frontend-uhheung-main.zip`. ZIP에는 Git 이력이 없으므로 프론트엔드 커밋 번호는 확인할 수 없다.
- 추가로 받은 `project-frontend-main.zip`과 비교한 결과, 최상위 폴더명 외에 내부 218개 파일의 경로와 바이트 내용이 모두 동일했다. 따라서 두 ZIP에서 수정 전/후의 차이를 확인할 수 없었다.
- 백엔드: `IRI-JEORI/project-backend-uhheung`, `main`, `01750fb4d265a0580f10199ee2587c3bba6767df`.
- 백엔드의 컨트롤러, 요청/응답 DTO, FirebasePushSender와 `docs/NUNNUN API_SPEC.pdf`를 비교했다. PDF에 상세 필드가 없는 오늘 시간 수정 요청은 현재 main의 DTO를 기준으로 했다.
- React Native 0.86.2 / React 19.2.3 / TypeScript 프론트엔드와 Java 21 / Spring Boot 백엔드다.
- 이 문서는 Android용이다. `ios/` 및 백엔드 소스는 수정하지 않았다. Android에서 사용하는 공통 TypeScript API 모듈에는 아래 계약 수정을 적용했다.

## 이번 수정

1. `src/api/nunnunApi.ts`: 취침 시간 요청을 `{ targetBedTime: "23:30" }`, 귀가 시간 요청을 `{ estimatedReturnTime: "20:15" }`로 수정했다. 이전 `bed_time` / `return_time` 필드는 백엔드 DTO와 달라 필수 값 검증에 실패할 수 있었다. 응답 타입도 실제 필드명으로 명시했다. 이 두 함수는 현재 화면에서 호출되지 않는 API 래퍼이므로 새로운 화면 기능을 추가한 것은 아니다.
2. `src/notifications/messaging.ts`: Android WAKE_REQUEST는 notification 없이 data에 title/body가 오는 형태다. 이제 포그라운드 알림에 서버가 보낸 문구를 표시한다. 기존 notification 문구와 기본 문구도 유지하며, 알람 시작·이동·로그아웃 후 무시 동작은 유지한다.
3. 두 기존 테스트 파일에 시간 요청 계약 및 data-only Android 알림 회귀 테스트를 추가했다.
4. `src/config/api.ts`: 2026-09-11 전달받은 Tunnel 운영 방식에 맞춰 서버 주소를 이 파일의 `SERVER_URL` 한 곳으로 통합했다. 앞서 추가했던 `api.android.ts`는 제거했다. 새 Tunnel 주소가 아직 없으므로 Android 에뮬레이터 로컬 주소를 유지한다. URL 끝의 슬래시와 양끝 공백은 자동 제거한다. iOS 네이티브 파일은 수정하지 않았다.
5. `src/screens/PersonalGroupScreen/__tests__/PersonalGroupDnd.test.tsx`: 원본에서도 실패한 테스트의 mock에 실제 DND 응답의 요일·시작/종료 시간 필드를 채웠다. 화면 기대값도 기존 UI의 `월요일 09:00~10:00` 형식에 맞췄다. 화면 소스는 변경하지 않았다.

## API 구조 비교

| 기능 | 실제 경로 및 계약 | 결과 |
| --- | --- | --- |
| 데모 로그인 | GET `/demo-accounts`, POST `/auth/demo-login`, `demo_account_id`, snake_case 토큰 | 기존 구현 일치 |
| 토큰 갱신·로그아웃 | POST `/auth/reissue`, POST `/auth/logout`, `refreshToken`; 갱신 응답 `accessToken`, `refreshToken` | 기존 구현 일치. EXPIRED_JWT에만 1회 갱신/재시도 |
| 내 정보 | GET/PATCH/DELETE `/users/me`; 수정 `nickname` | 기존 구현 일치 |
| Android 기기 | POST `/devices`, `fcm_token`, `platform: ANDROID` | 기존 구현 일치. 실제 Firebase 설정 필요 |
| 기상 목표·방해금지 | `/me/wake-targets`, `/me/dnd-windows`; 생성 `text`, 응답 snake_case | 기존 구현 일치 |
| 고정 일정 | `/me/fixed-schedules`; `dayOfWeek`, `startTime`, `endTime` | 기존 구현 일치 |
| 오늘·수면·통계 | GET `/me/today`, POST `/me/sleep`, GET `/me/stats` | 기존 구현 일치. today는 camelCase와 snake_case가 혼재하므로 일괄 변환 금지 |
| 오늘 시간 변경 | PATCH `/me/today/bed-time`, `/me/today/return-time` | 요청 필드명 수정 |
| 그룹 | GET `/groups`, `/wake-groups` 생성·조회·수정·참여·탈퇴·초대 코드 | 기존 구현 일치 |
| 깨우기·자가 인증 | 그룹 멤버 wake, self-verify, `/wake-requests/{id}` 및 pending | 기존 구현 일치 |
| 사진 인증·공유 | `/wake-requests/{id}/proof`, `/proof/share`, `/success/ack` | `image` multipart와 `group_ids` 계약 유지 |
| Android 푸시 | `type=WAKE_REQUEST`, 문자열 `referenceId`, data의 `title`, `body` | ID 해석은 기존 구현 일치. 문구 표시 수정 |

성공 응답의 `{ success: true, data: ... }`를 공통 클라이언트에서 풀고, Authorization Bearer 토큰을 붙인다. 사진은 FormData로 보내며 boundary를 직접 지정하지 않는다.

## 실행에 필요한 설정

1. Firebase 콘솔에서 백엔드와 같은 프로젝트에 등록된 Android 앱 `com.nunnun`의 `google-services.json`을 내려받아 `android/app/google-services.json`에 넣는다. ZIP에는 이 파일이 없고 `.gitignore`에서도 제외돼 있다. 백엔드의 서비스 계정 JSON을 이 위치에 넣으면 안 된다.
2. `src/config/api.ts`의 `SERVER_URL` 한 곳만 수정한다. 현재 임시값은 `http://10.0.2.2:8080`이다. 테스트 시작 시 전달받은 실제 HTTPS Tunnel 주소로 교체한다. `/devices` 같은 API 경로를 Base URL에 붙이지 않는다. 기존 `BACKEND_INTEGRATION.md`의 주소 설명 대신 이 문서를 따른다. 개발 중에는 앱을 새로고침하고, 이미 배포한 APK는 주소 변경 후 다시 빌드해야 한다. 실행 중인 APK에 서버 주소가 자동으로 바뀌는 기능은 추가하지 않았다.
3. Android Manifest에는 인터넷·카메라·알림·알람 서비스 권한과 HTTP 허용이 이미 있다. 추가 변경하지 않았다.
4. 백엔드는 Firebase 활성화 및 해당 프로젝트의 서버 자격증명, DB/JWT 설정이 필요하다. 사진 인증은 서버의 S3/OpenAI 설정도 필요하다.
5. 프로젝트 폴더에서 `npm ci` 후 `npm run android`로 실행한다. APK는 `android` 폴더에서 `gradlew.bat assembleDebug`로 빌드한다. 기존 앱 업데이트 호환성을 위해 서명 설정·키와 applicationId는 변경하지 않았다.

### 로컬 백엔드 실행 순서

1. Java 21 및 MySQL을 준비하고 로컬 개발용 `nunnun` DB를 만든다.
2. 백엔드 실행 환경에 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`을 설정한다. DB_URL 예시는 `jdbc:mysql://127.0.0.1:3306/nunnun?useSSL=false&serverTimezone=UTC&characterEncoding=UTF-8`이다. 실제 계정·비밀번호·JWT 비밀값은 로컬 환경에만 입력한다. 저장소의 `.env.example`을 복사하기만 해서는 Spring Boot에 자동 주입되지 않는다.
3. 백엔드 저장소 main에서 `gradlew.bat bootRun`을 실행한다. 이 작업에서는 사용자의 로컬 DB를 생성하거나 비밀번호/서버 실행 환경을 설정하지 않았다.
4. PC 브라우저에서 `http://localhost:8080/v3/api-docs`, 에뮬레이터 브라우저에서 `http://10.0.2.2:8080/v3/api-docs`가 열리는지 확인한다.
5. Firebase/S3/OpenAI가 비활성화된 기본 상태에서는 해당 외부 기능을 검증할 수 없다. 깨우기 푸시는 서버 Firebase 설정과 앱 `google-services.json`을 모두 준비한 뒤 테스트한다.

## 기존에 남아 있는 화면 범위

- 로그인 화면은 데모 계정 선택 흐름이다. 회원가입 화면은 입력값을 서버에 보내지 않고 Permission 화면으로 이동하는 기존 UI다. 일반 회원가입/이메일 로그인 전환은 이번 최소 계약 수정에 포함하지 않았다.
- 시간 수정 API 래퍼, 시간표 이미지 분석/import 및 수면 피드백 래퍼 일부는 현재 화면에서 호출되지 않는다.
- 보상 목록 등 서버 API가 없는 데모 UI는 보존했다. 룸메이트 API는 백엔드에 있지만 Android 홈은 WAKE 그룹만 표시하는 기존 동작을 유지했다.
- `startSelfVerify`는 반드시 그룹 ID를 받는다. 예: `nunnunApi.wake.startSelfVerify(groupId)`.

## 실제 기기에서 남은 확인

- 로컬 서버의 `/v3/api-docs`에 접근 가능한지, 실행 코드가 위 main 커밋인지 확인한다. 기존 운영 IP 접근은 타임아웃이었으며, 이후 사용자 요청으로 로컬 에뮬레이터 설정으로 전환했다. 로컬 DB/서버는 아직 실행하지 않았다.
- 서로 다른 데모 계정으로 Android 기기 두 대에서 로그인하고 그룹 참여 후 깨우기를 보낸다.
- 포그라운드·백그라운드·앱 종료 후 알림 수신, 알림 탭 이동, 사진 성공/실패/재시도, 로그아웃 후 알림 무시를 확인한다.
- `google-services.json`을 넣고 Android 빌드 및 실제 FCM 수신을 검증하기 전에는 전체 연동 완료로 간주하지 않는다.

## 이전 로컬 버전 검증 결과 (2026-09-10)

- `package-lock.json` 기준 의존성 설치 후 전체 Jest 테스트: 30개 suite / 217개 test 모두 통과. 느린 초기 실행을 고려해 테스트 실행 옵션에 `--testTimeout 30000`을 사용했다. 저장소 테스트 설정은 변경하지 않았다.
- `tsc --noEmit`: 통과.
- Metro Android production JS bundle 및 47개 asset 생성: 성공. APK 빌드와는 별개다.
- 생성된 Android bundle에 `http://10.0.2.2:8080` 포함, `http://1.201.116.185` 미포함을 확인했다.
- 원본 ZIP 대조: 기존 파일 5개 수정, 새 파일 2개 추가. `ios/`, `package.json`, `package-lock.json`, Android 네이티브/서명 설정은 바이트 기준 변경 없음. 백엔드 Git 작업 트리도 변경 없음.
- 초기 npm 설치의 후처리 실행이 환경의 프로세스 권한 제한으로 실패하여, 검증용 설치에는 `npm ci --ignore-scripts`를 사용했다. Jest/Metro 임시 파일은 쓰기 가능한 작업 폴더로 지정했다. 사용자 환경용 의존성/설정은 변경하지 않았다.
- Firebase 설정 누락으로 APK 빌드·에뮬레이터 설치·실제 푸시/사진 업로드는 검증하지 못했다. 로컬 DB 및 백엔드 실행도 수행하지 않았다. 서버가 켜진 후 위 실행 순서로 종단 간 확인이 필요하다.


## Tunnel 서버 연동 갱신 (2026-09-11)

- 전달받은 Firebase 프로젝트 ID: `nunnun-6b062`. 콘솔 내부 설정은 직접 확인하지 못했다. 이 프로젝트의 Android 앱 패키지 `com.nunnun`용 `google-services.json`을 `android/app/`에 넣는다.
- 로그인 성공 후 알림 권한 요청 → FCM 토큰 발급 → `POST /devices` 등록 흐름이 이미 구현돼 있다. 요청은 `{ fcm_token, platform: "ANDROID" }`이며 공통 클라이언트에서 Bearer Access Token을 붙인다. 토큰 변경 시 재등록 처리도 있다.
- Firebase 등록 실패가 로그인 실패로 이어지지 않도록 기존 예외 처리를 유지한다. 실제 등록 성공은 서버 로그/실기기 통합 테스트에서 확인해야 한다.
- 백엔드가 Spring Boot/MySQL/Firebase/S3 설정을 완료했다는 팀 안내를 기준으로 한다. 서버 상태 자체는 새 URL을 받기 전까지 확인할 수 없다.
- 이전 수정본을 덮어쓸 경우 남아 있는 `src/config/api.android.ts`는 반드시 제거한다. 새 ZIP을 별도 폴더에 풀어 사용하는 것이 가장 간단하다.
- iOS 구현은 작업 범위에서 제외했다. 공통 API config를 다른 플랫폼에서 함께 사용하는 경우 같은 Base URL이 적용된다는 점은 팀과 공유한다.
- 다음 단계: 현재 Tunnel Base URL과 Android용 Firebase 설정 파일 확보 → APK 빌드 → 로그인/기기 등록 → 깨우기/푸시/사진 인증. iPhone 측 검증은 iOS 담당자가 수행한다.
