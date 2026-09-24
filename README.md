# 모두의 콘솔 (modu_admin)

모두 서비스를 운영하는 내부 웹 콘솔 모음이다. 세 콘솔은 성격이 달라 따로 배포하고, 같은 관리자 로그인과 게이트웨이를 쓴다.

| 디렉터리 | 이름 | 하는 일 | 개발 서버 | 도커 |
|---|---|---|---|---|
| `modu-admin/` | 모두의 어드민 | 기존 백오피스. 회원, 채팅방, 푸시, 앱 설정, 포인트, 상품, 주문, 리뷰 운영 | 5173 | 8081 |
| `modu-system/` | 모두 시스템 | 시스템 운영. 지금은 게이트웨이 라우트 설정 조회 | 5176 | 8084 |
| `modu-internal/` | 모두 인터널 | 사내 업무. 지금은 회원 조회(직원 여부 설정 예정) | 5177 | 8085 |
| `packages/console-core/` | 공통 기반 | 관리자 로그인, 게이트웨이 API 클라이언트, 레이아웃, 스타일, 시간대 표시 | - | - |

## 구조

- `modu-system`, `modu-internal`, `packages/console-core` 는 npm 워크스페이스다. 루트에서 한 번에 설치하고 두 콘솔이 공통 패키지를 소스 그대로 가져가 번들한다.
- `modu-admin` 은 워크스페이스 밖의 독립 패키지다(자기 `package-lock.json`). 옮기기만 했고 코드는 그대로다. 공통 패키지로 옮기는 것은 나중 일이다.
- 로그인은 세 콘솔 모두 auth-service 관리자 계정(`admin_password` 그랜트, client `modu-admin`)이다. 토큰은 콘솔마다 따로 저장된다(출처가 다르다).
- 새 콘솔은 게이트웨이를 같은 출처로 부른다. 개발은 Vite proxy, 도커는 nginx 가 `gateway-service:8000` 으로 넘긴다. 그래서 게이트웨이 CORS 설정이 필요 없다.

## 필요한 백엔드

- [modu_infra](https://github.com/tear94fall/modu_infra), [modu_platform](https://github.com/tear94fall/modu_platform)(config·discovery·gateway), [modu_chat](https://github.com/tear94fall/modu_chat) `backend/`(auth, member 등)
- modu-system 의 게이트웨이 설정 조회는 게이트웨이의 `GET /gateway-service/api-admin/config`(관리자 토큰)를 쓴다.

## 개발

```bash
# 새 콘솔(워크스페이스)
npm install
npm run dev -w modu-system       # http://localhost:5176
npm run dev -w modu-internal     # http://localhost:5177
npm test                         # 워크스페이스 전체 테스트

# 기존 어드민
cd modu-admin && npm install && npm run dev    # http://localhost:5173
```

## 도커

```bash
docker compose up -d --build                  # 세 콘솔 모두
docker compose up -d --build modu-system      # 하나만
```

nginx 는 게이트웨이를 이름으로만 알고 10초마다 다시 조회한다. 게이트웨이를 다시 배포하거나 콘솔을 먼저 띄워도 다시 시작할 필요가 없다.
