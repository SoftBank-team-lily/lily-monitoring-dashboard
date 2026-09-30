# 대시보드 API 계약 (초안)

대시보드(Next.js)가 Observability API에 기대하는 응답 형식입니다. 타입 정의는 `lib/types.ts`에 같은 내용으로 있어요.

## 먼저 맞추고 싶은 것

1. **앱 지표는 버전별로 나눠 주세요.** `version`(APP_VERSION), `color`(APP_COLOR), `role`(stable = 기존, canary = 새 버전). 카나리에서 "어느 버전이 문제인지"를 보여 주는 데 꼭 필요해요.
2. **상태(`status`)와 한 줄 조치 문구(`hint`)는 백엔드에서 계산해 주세요.** Logging 모듈의 위험도 판정과 같은 임계값을 써야 화면 색과 판정이 어긋나지 않아요. 화면은 임계값을 다시 계산하지 않아요.
3. **요청이 너무 적으면 `unknown`.** 최소 요청 수(`minRequests`)보다 적으면 정상·위험을 판단하지 않아요.
4. **단위**: 에러율은 0~1 비율(3.1% → `0.031`), 응답 시간은 ms, 시각은 ISO-8601 UTC 문자열.
5. **시계열 길이**: `timestamps`와 각 값 배열의 길이가 같아야 해요. 그 시점에 없던 버전은 `null`.
6. **로그**: 메시지의 토큰·비밀번호는 가려서, 예외는 클래스와 메시지 첫 줄만.
7. **CORS**: 개발 중에는 `http://localhost:3000` 허용.
8. **트래픽 비율(`traffic`)**: CI/CD 배포 정보가 연결되기 전에는 `null`이어도 돼요. 화면에 안내 문구가 대신 나와요.

상태 값: `ok`(정상) · `warn`(주의) · `bad`(위험) · `unknown`(판단 보류)

## 1. 앱별 지표

`GET /api/apps/{app}/metrics?range=15m` (`range`: `15m` | `1h`)

```json
{
  "app": "lily-blog-sample",
  "generatedAt": "2026-09-30T07:04:12Z",
  "window": "5m",
  "status": "bad",
  "hint": "새 버전 v42의 에러율이 2.4%로 기준(2%)을 넘었어요. 롤백 여부를 확인하세요.",
  "traffic": [
    { "version": "v41", "color": "blue", "role": "stable", "weight": 90 },
    { "version": "v42", "color": "green", "role": "canary", "weight": 10 }
  ],
  "versions": [
    {
      "version": "v41", "color": "blue", "role": "stable",
      "requests": 1785, "errorRate": 0.004, "p95Ms": 180,
      "statuses": { "requests": "ok", "errorRate": "ok", "p95Ms": "ok" }
    },
    {
      "version": "v42", "color": "green", "role": "canary",
      "requests": 198, "errorRate": 0.024, "p95Ms": 354,
      "statuses": { "requests": "ok", "errorRate": "bad", "p95Ms": "ok" }
    }
  ],
  "panels": {
    "requests":  { "status": "ok",  "hint": null },
    "errorRate": { "status": "bad", "hint": "새 버전 v42의 에러율이 2.4%로 기준(2%)을 넘었어요. 롤백 여부를 확인하세요." },
    "p95Ms":     { "status": "ok",  "hint": null }
  },
  "thresholds": {
    "errorRate": { "warn": 0.01, "bad": 0.02 },
    "p95Ms": { "warn": 400, "bad": 800 },
    "minRequests": 20
  },
  "series": {
    "stepSeconds": 30,
    "timestamps": ["2026-09-30T06:49:42Z", "2026-09-30T06:50:12Z"],
    "byVersion": {
      "v41": { "requests": [170, 182], "errorRate": [0.004, 0.005], "p95Ms": [185, 190] },
      "v42": { "requests": [null, 19], "errorRate": [null, 0.006], "p95Ms": [null, 262] }
    }
  }
}
```

- `window`: 버전별 요약값(`versions`)을 계산한 구간
- `status`: 세 패널 중 가장 나쁜 상태, `hint`: 그 패널의 문구
- `series.byVersion[버전].requests`: `stepSeconds` 구간마다의 요청 수

## 2. 앱별 최근 로그

`GET /api/apps/{app}/logs?limit=50&level=WARN` (최신순, `level`은 그 수준 이상. 생략하면 전체)

```json
{
  "app": "lily-blog-sample",
  "items": [
    {
      "timestamp": "2026-09-30T07:03:17Z",
      "level": "ERROR",
      "version": "v42",
      "color": "green",
      "pod": "lily-blog-sample-green-7d4b9c6f8-m8zrt",
      "message": "GET /api/posts 500 Internal Server Error",
      "exception": "java.lang.IllegalStateException: chaos: forced error",
      "traceId": null
    }
  ],
  "nextCursor": null
}
```

## 3. 서버별 CPU·메모리

`GET /api/servers?range=15m`

```json
{
  "generatedAt": "2026-09-30T07:04:12Z",
  "servers": [
    {
      "name": "k3s-worker-1",
      "role": "worker",
      "status": "warn",
      "hint": "메모리 사용률이 76%예요. 새 파드를 더 올리기 전에 여유를 확인하세요.",
      "cpuPercent": 64,
      "memory": { "usedBytes": 3264175144, "totalBytes": 4294967296, "percent": 76 },
      "pods": 9,
      "series": { "stepSeconds": 30, "timestamps": ["..."], "cpuPercent": [62.1], "memoryPercent": [75.4] }
    }
  ]
}
```

- `role`: `server`(관리 노드) | `worker`(작업 노드)
- `series`는 선택. 지금 화면은 현재 값만 쓰고, 추이 그래프를 붙일 때 사용해요.

## 나중에 추가하면 좋은 것

- `GET /api/apps`: 앱 목록 (지금은 환경 변수 `NEXT_PUBLIC_APPS`로 대신)
- 배포 이벤트 스트림(SSE): 실시간 갱신과 차트의 배포 시점 표시용

## 백엔드에 전달할 요청 요약

제안하신 앱 지표 / 앱 로그 / 서버 지표 3개 API면 현재 모니터링 패널을 구성할 수 있습니다. 아래 정보를 함께 부탁드립니다.

- 앱 지표: 버전별 요청 수, 에러율, p95 응답 시간과 시계열. `generatedAt`, 요약 구간 `window`, 시계열 간격 `stepSeconds`도 포함해 주세요.
- 앱 로그: 시각, level, version, pod, message, 예외 첫 줄, 가능하면 traceId. 최신순으로 반환해 주세요.
- 서버 지표: 노드명, 역할, CPU %, 메모리 사용량/전체량/%, Pod 수, 상태와 수집 시각.
- 에러율의 오류 범위(예: HTTP 5xx)와 CPU 비율의 분모(예: 노드 전체 CPU)를 합의해야 합니다.
- 실제 p95는 해당 요약 구간의 원본 분포/히스토그램으로 계산해야 합니다. 구간별 p95의 평균은 전체 p95가 아닙니다. 현재 mock의 요약 p95는 UI 시연을 위한 근삿값입니다.
- 수집 실패나 표본 부족을 0% 에러율/0ms로 치환하지 말고 `unknown`, nullable 값 또는 별도 데이터 없음 상태로 구분해 주세요. 현재 `VersionSummary.errorRate`는 number여서, nullable로 확정하면 프런트 타입도 같이 맞추겠습니다.
- 트래픽 가중치는 CI/CD 미연결 시 `null` 가능하며, 실제 관측 요청 비율과 구분합니다.

입자와 패널의 연결은 프런트 표현이므로 추가 토폴로지 API가 필요하지 않습니다.
현재 로그 검색과 버전 필터는 받아온 최신 로그에 적용합니다. 향후 전체 이력 검색에는 서버 측 `version`, `query`, 시간 범위, `cursor` 쿼리를 함께 합의해야 합니다.
