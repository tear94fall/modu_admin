# 모두의 어드민 (modu-admin)

> 이 앱은 [modu_admin](../README.md) 레포의 `modu-admin/` 디렉터리다(2026-09-25 콘솔 모음 레포로 바꾸면서 옮겼다). 독립 패키지라 이 디렉터리에서 `npm install` 한다.

모두메신저·모두의 커머스 관리자 전용 React 프런트엔드(회원·채팅방·공지·푸시·앱 설정·상품 관리). Vite + React + TypeScript, `react-router-dom` 으로 라우팅한다.

## 필요한 백엔드

이 앱은 별도 저장소의 서비스에 붙는다. 먼저 아래를 띄운다.

- [modu_infra](https://github.com/tear94fall/modu_infra) — MySQL·Redis 등 공용 인프라
- [modu_chat](https://github.com/tear94fall/modu_chat) `backend/` — gateway(8000), auth, member, chat, push 서비스. 어드민은 게이트웨이의 `/api-admin/**` 라우트만 호출한다.
- [modu_commerce](https://github.com/tear94fall/modu_commerce) `backend/` — 상품 관리 화면이 쓰는 commerce-service(8200). 게이트웨이가 `/commerce-service/api-admin/**` 로 넘긴다.

원래 modu_chat 저장소의 `admin/` 폴더였고, 2026-09-18 에 이력을 유지한 채 이 저장소로 분리했다.

## 실행

```bash
npm install
npm run dev       # http://localhost:5173
```

게이트웨이 주소는 `.env` 의 `VITE_API_BASE_URL` 로 설정한다 (`.env.example` 참고).

```bash
cp .env.example .env
# .env
VITE_API_BASE_URL=http://localhost:8000
```

값을 생략하면 기본값 `http://localhost:8000` 을 사용한다. 게이트웨이([modu_chat](https://github.com/tear94fall/modu_chat) `backend/.env` 의 `ADMIN_ALLOWED_ORIGIN`)는 `http://localhost:5173` 을 허용하도록 이미 설정되어 있어야 한다.

## 도커로 띄우기

개발 서버 대신 nginx 컨테이너로 서빙한다. 빌드된 정적 파일을 nginx 가 내고, `/auth-service/`, `/member-service/`, `/chat-service/`, `/push-service/`, `/storage-service/`, `/commerce-service/` 경로는 같은 네트워크의 `gateway-service:8000` 으로 프록시한다. 브라우저는 같은 출처만 부르므로 게이트웨이 CORS 설정이 필요 없다.

```bash
# modu_infra, modu_platform(gateway-service)이 떠 있는 상태에서, 레포 루트에서
docker compose up -d --build modu-admin     # http://localhost:8081
```

포트는 `ADMIN_PORT` 로 바꾼다(기본 8081). 개발 서버(5173)와 겹치지 않으니 둘을 같이 띄워도 된다. 이미지는 API 주소를 비워(상대 경로) 빌드하므로 환경마다 다시 빌드할 필요가 없다.

`npm run dev` 로 띄울 때만 브라우저가 게이트웨이(`http://localhost:8000`)를 직접 부르며, 이때는 게이트웨이의 `ADMIN_ALLOWED_ORIGIN` 이 `http://localhost:5173` 을 허용해야 한다.

## 로그인(직원 Google 로그인)

이메일·비밀번호 로그인은 없어졌다. **직원으로 등록된 Google 계정**으로 로그인하고, 토큰에 **어드민 권한(`ROLE_ADMIN`)** 이 있어야 이 콘솔을 쓴다. 권한이 없으면 "이 콘솔을 쓸 권한이 없습니다" 화면(계정·가진 권한·로그아웃)이 나온다.

- Google 버튼(Google Identity Services 팝업)이 준 ID 토큰을 `POST /auth-service/oauth2/token`(`grant_type=urn:modu:params:oauth:grant-type:google_id_token`, `client_id=modu-admin`)으로 바꾼다. 직원이 아니면 400 `invalid_grant` → "직원 계정이 아닙니다. 최상위 관리자에게 직원 등록을 요청하세요."
- 직원 권한은 넷이다: 최상위 `SUPER`(모든 콘솔 + 직원 지정·권한 변경), 어드민 `ADMIN`(이 콘솔), 시스템 `SYSTEM`(모두 시스템), 인터널 `INTERNAL`(모두 인터널). 최상위의 토큰은 `ROLE_SUPER`, `ROLE_ADMIN`, `ROLE_SYSTEM`, `ROLE_INTERNAL` 을 모두 가진다.
- 직원 지정·권한 변경은 모두 인터널(`modu-internal`)의 회원 상세에서 최상위가 한다. **첫 최상위는 member-service DB 에 직접 넣는다**(`staff` 행 + `SUPER` 의 `staff_permission` 행, 자세한 것은 [루트 README](../README.md#첫-최상위-관리자)).
- Google 웹 클라이언트 ID 는 커머스 웹과 같다(`VITE_GOOGLE_CLIENT_ID` 로 바꿀 수 있다). 그 클라이언트의 **"승인된 JavaScript 원본"** 에 `http://localhost:5173`(개발), `http://localhost:8081`(도커)과 LAN IP 로 여는 `http://192.168.0.3:5173`, `http://192.168.0.3:8081` 이 있어야 한다(다른 콘솔 출처는 루트 README).

## 기능

- **로그인** (`/login`): 직원 Google 계정으로 로그인, 액세스·refresh 토큰을 로컬 스토리지에 저장. 어드민 권한이 없으면 권한 없음 화면.
- **회원 관리** (`/members`): 키워드 검색, 페이지네이션, 행 클릭 시 상세 이동.
- **회원 상세** (`/members/:id`): 회원 정보 + 친구 수.
- **채팅방 관리** (`/rooms`): 채팅방 목록(이름/인원/최근 메시지/최근 시각), 페이지네이션, 행 클릭 시 상세 이동.
- **채팅방 상세** (`/rooms/:roomId`): 멤버 목록 + 최근 메시지 목록.
- **상품 관리** (`/products`): 모두의 커머스 상품 목록(최신 등록순)·검색·페이지네이션, 행 클릭 시 수정 화면 이동. 게이트웨이 `/commerce-service/api-admin/**` 를 부른다.
- **상품 등록/수정** (`/products/new`, `/products/:id`): 이름·가격·설명·이미지 URL(미리보기). 수정 화면에서 확인 후 삭제(소프트 삭제). 검증 실패 시 서버가 준 이유를 보여 준다.
- **푸시 발송** (`/push`): 전체 발송(그룹 브로드캐스트) / 특정 사용자 발송 탭, 제목·본문·이미지 URL 입력.
- 인증되지 않은 접근은 `/login` 으로 리다이렉트되고, API 가 401 을 반환하면 토큰을 지우고 로그인 화면으로 이동한다.

## 테스트 / 빌드

```bash
npm test        # vitest run
npm run build   # tsc -b && vite build
```
