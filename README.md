# Lily 모니터링

Next.js 16 · React 19 · TanStack Query · Recharts · Three.js.
로그인한 사용자의 프로젝트를 lily-frontend API로 확인하고, 실제 배포·관측 정보를 꽃과 6개 패널에 표시합니다.

## 실행과 연결

```bash
npm ci
cp .env.example .env.local
npm run dev -- --port 3000
```

- 대시보드 `.env.local`: `FRONTEND_URL=http://127.0.0.1:3210` (서버가 접근하는 프런트 URL).
- 설정 변경 요청에는 `FRONTEND_AUTH_ORIGIN`을 프런트의 `BETTER_AUTH_URL`과 같은 origin으로 설정합니다. 로컬 예: `http://localhost:3210`.
- 프런트 `.env.local`: `DASHBOARD_ORIGIN=http://127.0.0.1:3000`.
- 프런트를 3210 포트로 실행한 뒤 **http://localhost:3210/dashboard** 에서 접속합니다.
- 로그인 후 내 프로젝트를 선택합니다. 직접 링크: `/dashboard?project=<UUID>`.
- 별도 포트에서 직접 접속할 때만 `FRONTEND_PUBLIC_URL=http://localhost:3210`을 설정하세요.
- 서비스 연결 정보는 프런트의 `OBSERVABILITY_URL`, `INGRESS_API_URL`, `PROVISIONER_URL`에 설정합니다.
  대응하는 `*_API_TOKEN`은 프런트 서버 전용이며 대시보드·브라우저에 전달하지 않습니다.

## 실제 프로젝트 화면

- 서버에서 로그인·이메일 인증·프로젝트 소유권을 검사합니다. 폴링 API도 요청마다 검사합니다.
- 프로젝트 목록은 페이지 단위로 조회합니다. 앱 이름을 직접 입력해 다른 앱을 조회할 수 없습니다.
- 지표: 분당 요청, 오류율(5xx), 평균·p95 응답, 앱 전체 시계열.
- 배포: 최근 시도 결과·단계·빌드 로그와 현재 실행 슬롯·이미지를 구분합니다.
- 자원: 선택한 앱의 파드, 준비 상태, 재시작, CPU(mCPU), 메모리(MiB). 미수집 값은 표시로 구분합니다.
- 실행 로그: 전체/오류 포함 필터, 기간별 최근 100줄. 빌드 로그와 별도입니다.
- 추가 정보: 해당 앱의 라우팅·카나리 비중과 관리형 DB 상태. ingress 관리 API가 없어도 observer가 확인한 앱 공개 주소를 표시하며 라우트 세부 정보는 미연결로 구분합니다.
- 배포 중에는 5초, 평상시 15초 갱신합니다. 세션이 만료되면 캐시를 비우고 인증 화면으로 이동합니다.
- API 미연결·장애·매핑 대기·온프레미스 관측 미지원 상태에서 예시 수치를 만들지 않습니다.
- 공간 보기의 꽃·360도 카메라·패널 확대와 목록/모바일 보기를 유지합니다.
- 거점과 트래픽: 온프레미스 프로젝트의 HOME 에이전트·AWS Pod 상태를 한 화면에서 보고, 공개 주소 거점 전환·취소와 버스팅 자동(클라우드 0%, 과부하 때 전달)/수동 비율을 조절합니다. 설정은 프런트의 소유권 검사 API를 통해 저장합니다.
- HOME/AWS 각각의 CPU·RAM·p95 값은 현재 수집 API에 없습니다. 임의 값을 만들지 않고 `미수집`으로 표시합니다. 별도 거점 지표 API가 제공되면 두 카드에 연결해야 합니다.

## 명시적 데모

`/dashboard/demo?scenario=bad|healthy|single`에서만 기존 시연 데이터를 사용합니다.
실제 project 진입에는 데모 환경변수가 적용되지 않습니다.

## 배포

`basePath`는 `/dashboard`로 고정하며 빌드 시 적용합니다. Dockerfile은 standalone 앱을 생성합니다.
`FRONTEND_URL`은 실행 시 주입합니다. 공개 ingress/nginx는 **동일 origin**에서 `/dashboard`와
`/dashboard/*`를 대시보드로, 나머지는 프런트로 전달하세요. 경로 접두사를 제거하지 않습니다.
프런트 Next rewrite를 사용할 경우 `DASHBOARD_ORIGIN`은 프런트 빌드 시에도 필요합니다.
운영 ingress를 직접 구성하면 프런트의 `DASHBOARD_ORIGIN`도 설정해 꽃 진입점을 활성화하세요.

실제 계약: [프로젝트 관측 API](docs/project-api.md).
기존 [화면 검토](docs/design-review.md)와 [데모 API 설계](docs/api-contract.md)는 시제품 참고 문서입니다.

## 다국어 UI

한국어(기본) · 영어 · 일본어를 상단 지구본 메뉴에서 선택할 수 있습니다. 프런트와 대시보드 사이에서도 설정을 유지합니다. 번역 추가와 연결 방식은 [언어 설정 문서](docs/i18n.md)를 참고하세요.
