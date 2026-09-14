# Android 연동 점검 (2026-09-14)

## 확인한 코드
- Base URL: src/config/api.ts 한 곳에서 관리. 현재 주소의 유효성은 테스트 직전 재확인 필요.
- 로그인 후 /devices에 Bearer 인증으로 fcm_token, platform=ANDROID 전송. 토큰 갱신 구독 있음.
- data-only 수신: index.js background handler와 foreground handler가 WakeAlarm 네이티브 서비스를 호출.
- 알림 클릭: MainActivity → WakeAlarmNavigation → WakeNotification 화면 경로 있음.
- 서버 pose.description과 pose.code를 사용. 재시도에 기존 requestId 전달.
- 사진: image 필드 multipart 업로드, 인증 헤더 사용, boundary는 fetch에 위임.

## 이번 수정
- src/api/client.ts: Android PNG/WEBP 파일의 MIME 및 업로드 파일 확장자를 실제 경로 확장자에 맞춤. 기존 JPEG 및 iOS 동작 유지. 파일 내용 변환은 하지 않음. 확장자가 없는 content URI는 기존 JPEG 기본값 유지하므로 실제 파일 검증 필요.
- src/api/__tests__/wakeProofApi.test.ts: Android JPEG/PNG/WEBP multipart 메타데이터 회귀 검증 추가.
- android/app/google-services.json: 사용자가 제공한 파일을 현재 Git 작업 폴더에도 복사. Git ignore 확인 대상이며 커밋 대상 아님.

## 아직 완료하지 않은 검증
- APK 생성 및 기기 설치. 이전 빌드는 Gradle daemon 중단으로 실패.
- 실제 최신 FCM 토큰의 /devices 등록 및 iPhone → Android 푸시.
- 실제 이미지 바이트 업로드와 AI 결과, 재시도 시 Pose 유지.
- foreground/background/terminated 각각의 수신·알림 클릭. Android 설정에서 강제 종료한 상태는 일반 종료 상태와 구분해서 기록.

## 실기기 테스트 순서
1. 백엔드 담당자에게 현재 HTTPS Base URL을 받아 src/config/api.ts에 적용.
2. Firebase nunnun-6b062 / com.nunnun 설정 확인 후 APK 빌드·설치.
3. Android 알림 및 카메라 권한 허용 후 테스트 계정 로그인.
4. 실제 기기의 FCM 토큰 발급과 POST /devices 성공을 확인. 공유 로그에 토큰 원문을 남기지 않음.
5. iPhone 담당자가 Android 계정에 깨우기 요청 전송.
6. Android 수신 → 알림 클릭 → 해당 requestId 화면과 서버 Pose 확인.
7. 사진 촬영 → image multipart 업로드 → AI 성공/실패 확인.
8. 실패하면 기존 requestId로 재시도하고 같은 Pose인지 확인.
9. foreground/background/terminated 각각 반복.
10. 성공/재시도 소진 후 알람 종료 및 화면 처리 확인.

백엔드 변경은 하지 않음. 이 문서는 코드 확인 결과이며 실제 기기 성공을 의미하지 않음.
