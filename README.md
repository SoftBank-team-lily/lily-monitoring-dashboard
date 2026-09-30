# Lily 모니터링

Next.js 16 · React 19 · TanStack Query · Recharts · Three.js.
`lily-frontend`의 검정·핑크 팔레트와 IBM Plex Sans KR에 맞춘 모니터링 시제품입니다.
lily-frontend와 동일한 꽃 마스크·색상·깊이 규칙으로 개화 상태의 입자를 생성하고, 꽃·별·연결선·정보 패널을 같은 Three.js 우주 공간에 배치합니다. 데스크톱 공간 보기는 창 전체를 채우고, 조작부는 공간 위에 고정합니다.

## 실행

```bash
npm ci
npm run dev
# http://localhost:3000
```

API 주소가 없으면 데모 데이터로 동작합니다.

| 주소 | 시나리오 |
|---|---|
| `/?scenario=bad` (기본) | 새 버전 에러율 기준 초과 |
| `/?scenario=healthy` | 앱 정상, 서버 한 대 메모리 주의 |
| `/?scenario=single` | 기존 버전만 존재 |

## 화면

- **공간 보기**: 꽃 중심의 입자와 연결된 5개 CSS3D 패널. 드래그로 360도 회전, 우클릭 드래그로 이동, 스크롤로 줌. 패널은 카메라 방향을 따라 배치되고 항상 정면을 향합니다. 줌해도 패널의 화면 크기를 유지해 내용을 읽을 수 있습니다.
- **상세 보기**: 입자 또는 패널의 상세 버튼을 누르면 카메라가 해당 패널 앞으로 이동합니다. 필터·검색·그래프를 그대로 조작하며, `Esc` / 전체 공간 보기로 직전 시점에 돌아갑니다. 시점 초기화는 첫 구도로 돌아갑니다.
- **목록 보기**: 상태 → 요약 → 추이 → 버전 비교 → 서버·로그.
- **모바일**: 2열 수치 요약과 세로 패널. WebGL을 실행하지 않습니다.
- **로그**: 수준·버전 필터, 수집된 결과 내 검색, 행을 펼쳐 Pod·Trace ID·예외 확인.
- **갱신**: 지표 15초 / 로그 10초. 그래프 조회 범위와 최근 5분 요약을 구분합니다.

공간 내부에서 패널로 이동하는 카메라 전환이 구현되어 있으며, lily-frontend의 배포 완료 화면에서 이어지는 전환은 아직 미연결입니다.
자세한 설계와 한계는 [화면 검토](docs/design-review.md)를 참고하세요.

## API 연결

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저에서 접근 가능한 Observability API 주소. 비우면 데모 |
| `NEXT_PUBLIC_USE_MOCK` | `1`이면 데모 모드 |
| `NEXT_PUBLIC_APPS` | 앱 선택 목록, 쉼표로 구분 |

[API 계약](docs/api-contract.md)에 세 가지 API의 타입·응답 예시와 백엔드 전달사항을 정리했습니다.

## 검증

```bash
npm run typecheck
node --experimental-strip-types scripts/verify-monitoring.mjs
node --experimental-strip-types scripts/verify-flower.mjs
npm run build
```

## k3s 이미지

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-observability-host -t lily-dashboard .
```

`NEXT_PUBLIC_*`는 빌드 시 포함됩니다. API 주소는 사용자의 브라우저에서 접근할 수 있어야 합니다. Docker 이미지는 이 작업에서 실행 검증하지 않았습니다.

## 주요 파일

- `components/Dashboard.tsx`: 쿼리, 패널 배치, 보기 전환
- `components/ParticleStage.tsx`: WebGL + CSS3D 공유 씬, OrbitControls, 패널로 이동하는 카메라, React 포털
- `lib/flower-particles.ts`: 원본 꽃 마스크를 읽는 입자 생성과 실제 중심 입자에 부착한 관측점
- `components/dashboard.module.css`: 공간·목록·모바일 레이아웃
- `lib/monitoring.ts`: 상태 요약 대상과 조사 시작 패널 선택
- `lib/types.ts`, `lib/api.ts`, `lib/mock.ts`: API 타입, 요청, 데모 데이터
