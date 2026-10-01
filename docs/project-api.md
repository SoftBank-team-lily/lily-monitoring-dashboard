# 프로젝트 관측 API

대시보드 서버 → `FRONTEND_URL`의 `/api/projects`, `/api/projects/:id`로 세션과 소유권 확인.
브라우저 → `/dashboard/api/projects/:id/monitor?window=15m&level=all` → 프런트 `/api/projects/:id/monitor`.
Cookie만 지정된 내부 프런트로 전달하며 응답은 private/no-store입니다. 임의 서비스 경로는 프록시하지 않습니다.

`lib/project.ts`는 프런트 관측 DTO의 화면용 타입입니다. 변경 시 프런트 `src/lib/monitor/schema.ts`와 함께 맞추세요.

| 필드 | 표시 |
| --- | --- |
| project.latestDeployment | 최근 배포 결과, 단계, 빌드 로그, URL |
| appName / namespace | DB에서 확인한 관측 대상 |
| metrics | current + series, 오류율 0~1, 응답 ms, 요청/분 |
| status | HOLD/NORMAL/NOTICE/WARNING/CRITICAL, 서버 판정 문구 |
| app | 실제 strategy, activeSlot, deployments |
| pods | 선택한 앱의 파드만, CPU millicores, 메모리 MiB |
| logs | at/pod/slot/image/message, 최근 100줄 |
| route | primaryHost/serviceName/servicePort/canary |
| databases | id/engine/status만 |

각 리소스는 `{state:"ready",data}` 또는 `{state,message}`입니다.
실패 상태: unconfigured/unavailable/pending/unsupported. 표본 부족은 status.level=HOLD.
관측 서버 일부가 실패해도 다른 리소스와 배포 결과는 표시합니다.
온프레미스 지표, 버전별 지표, 전체 로그 페이지 조회, 자동 롤백 실행은 이 API가 제공하지 않습니다.
서버 판정의 권장 조치를 자동 실행했다는 뜻으로 표시하지 않습니다.
