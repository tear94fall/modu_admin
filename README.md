# 모두의 콘솔 (modu_admin)

모두 서비스를 운영하는 내부 웹 콘솔 모음이다. 세 콘솔은 성격이 달라 따로 배포하고, 같은 직원 Google 로그인과 게이트웨이를 쓴다.

| 디렉터리 | 이름 | 하는 일 | 개발 서버 | 도커 |
|---|---|---|---|---|
| `modu-admin/` | 모두의 어드민 | 기존 백오피스. 회원, 채팅방, 푸시, 앱 설정, 포인트·쿠폰, 상품, 주문, 리뷰, 기획전·이벤트 운영 (어드민 권한) | 5173 | 8081 |
| `modu-system/` | 모두 시스템 | 시스템 운영. 게이트웨이 라우트, 설정 서버(config-repo) 조회, 서비스 배포 (시스템 권한) | 5176 | 8084 |
| `modu-internal/` | 모두 인터널 | 사내 업무. 회원 조회, 직원 지정·권한 관리(최상위만) (인터널 권한) | 5177 | 8085 |
| `packages/console-core/` | 공통 기반 | 직원 Google 로그인·권한 확인, 게이트웨이 API 클라이언트, 레이아웃, 스타일, 시간대 표시 | - | - |

## 구조

- `modu-system`, `modu-internal`, `packages/console-core` 는 npm 워크스페이스다. 루트에서 한 번에 설치하고 두 콘솔이 공통 패키지를 소스 그대로 가져가 번들한다.
- `modu-admin` 은 워크스페이스 밖의 독립 패키지다(자기 `package-lock.json`). 공통 패키지를 쓰지 않고 로그인 코드도 자기 것을 둔다(console-core 와 같은 방식).
- 토큰은 콘솔마다 따로 저장된다(출처가 다르다).
- 새 콘솔은 게이트웨이를 같은 출처로 부른다. 개발은 Vite proxy, 도커는 nginx 가 `gateway-service:8000` 으로 넘긴다. 그래서 게이트웨이 CORS 설정이 필요 없다.

## 로그인과 직원 권한

세 콘솔 모두 **직원으로 등록된 Google 계정**으로 로그인한다. 이메일·비밀번호 로그인(`admin_password` 그랜트)은 없어졌다.

1. 로그인 화면의 Google 버튼(Google Identity Services 팝업)이 Google ID 토큰을 준다.
2. 콘솔이 `POST /auth-service/oauth2/token` 에 `grant_type=urn:modu:params:oauth:grant-type:google_id_token`, `client_id=modu-admin`, `id_token=…` 을 보낸다.
3. auth-service 가 그 Google 계정의 이메일로 직원을 찾아 토큰(aud `modu-admin`)을 준다. 직원이 아니거나 탈퇴한 계정이면 400 `invalid_grant` 이고, 화면은 "직원 계정이 아닙니다. 최상위 관리자에게 직원 등록을 요청하세요." 를 보인다.
4. 토큰의 `roles` 가 직원 권한이다. 콘솔마다 필요한 권한이 없으면 "이 콘솔을 쓸 권한이 없습니다" 화면(계정·가진 권한·로그아웃)을 보인다.

| 권한 | 토큰 roles | 쓸 수 있는 것 |
|---|---|---|
| 최상위 `SUPER` | `ROLE_SUPER` + 아래 셋 모두 | 모든 콘솔. 직원 지정·권한 변경·해제를 할 수 있는 유일한 권한(모두 인터널의 회원 상세, 직원 메뉴) |
| 어드민 `ADMIN` | `ROLE_ADMIN` | 모두의 어드민 |
| 시스템 `SYSTEM` | `ROLE_SYSTEM` | 모두 시스템 |
| 인터널 `INTERNAL` | `ROLE_INTERNAL` | 모두 인터널(회원·직원 조회, 권한은 읽기만) |

직원 한 명은 권한을 1~4개 가진다(member-service 의 `staff`, `staff_permission` 테이블). refresh 때 서버가 권한을 다시 읽으므로, 권한을 바꾸면 다음 토큰 갱신부터 반영되고 직원에서 해제되면 refresh 가 실패해 로그아웃된다.

### 첫 최상위 관리자

직원 지정은 최상위만 할 수 있으므로 **첫 최상위는 DB 에 직접 넣는다.** 그 사람이 Google 로 쓸 이메일의 회원(`member`)이 있어야 하고(앱에서 Google 로 한 번 가입하면 생긴다), member-service DB(`modu-chat`)에서 그 회원의 `staff` 행과 `SUPER` 권한의 `staff_permission` 행을 만든다:

```sql
insert into staff (member_id, created_date, modified_date) values (<member_id>, now(), now());
insert into staff_permission (member_id, permission) values (<member_id>, 'SUPER');
```

그다음부터는 그 계정으로 모두 인터널에 들어가 회원 상세에서 다른 직원을 지정한다.

### Google 클라이언트 설정

Google 웹 클라이언트 ID 는 커머스 웹과 같은 것을 쓴다(비밀 아님, `VITE_GOOGLE_CLIENT_ID` 로 바꿀 수 있다). Google Cloud 콘솔의 그 OAuth 클라이언트 **"승인된 JavaScript 원본"** 에 콘솔의 출처가 모두 있어야 버튼이 동작한다.

| | 개발 서버 | 도커 |
|---|---|---|
| localhost | `http://localhost:5173`, `http://localhost:5176`, `http://localhost:5177` | `http://localhost:8081`, `http://localhost:8084`, `http://localhost:8085` |
| LAN IP | `http://192.168.0.3:5173`, `http://192.168.0.3:5176`, `http://192.168.0.3:5177` | `http://192.168.0.3:8081`, `http://192.168.0.3:8084`, `http://192.168.0.3:8085` |

## 필요한 백엔드

- [modu_infra](https://github.com/tear94fall/modu_infra), [modu_platform](https://github.com/tear94fall/modu_platform)(config·discovery·gateway), [modu_chat](https://github.com/tear94fall/modu_chat) `backend/`(auth, member 등)
- modu-system 의 게이트웨이 설정 조회는 게이트웨이의 `GET /gateway-service/api-admin/config`(`ROLE_SYSTEM`)를 쓴다.
- modu-system 의 Config 설정 조회는 `GET /config-service/api-admin/config-repo/files`, `/file?path=` 를 쓴다. 게이트웨이가 `ROLE_SYSTEM` 토큰을 보고 config-service 로 넘기며, 비밀값은 config-service 가 가려서 준다.
- modu-system 의 배포 탭(`/deploy`, 메뉴 배포 → 서비스 배포)은 deploy-service(modu_chat `backend/`, 게이트웨이 `/deploy-service/api-system/deploy/...`, `ROLE_SYSTEM`)를 쓴다. 서비스마다 실행 중 태그·modu_infra kustomization 의 Git 태그·준비 상태를 보여 주고, GHCR 태그(`develop-*`·`master-*`)를 골라 배포하면 deploy-service 가 kustomization 을 커밋 → Argo CD 동기화 → 롤아웃을 차례로 진행한다. 화면은 2초마다 `GET /deployments/{id}` 를 읽어 단계(커밋 → Argo 동기화 → 롤아웃)·진행률·파드 상태를 보여 주고, 롤백은 마지막 성공 배포의 이전 태그로 다시 배포한다. 서비스 상세(`/deploy/{name}`)는 그 서비스의 태그·준비 상태·배포 이력을, 배포 이력(`/deploy/history`)은 최근 50건을 서비스·상태로 걸러 보여 준다(행을 펼치면 단계·커밋·오류). 이력은 deploy-service 메모리에만 있어 다시 뜨면 비워진다(dev). nginx·Vite proxy 에 `deploy-service` 경로가 들어 있다.
- modu-internal 은 member-service 직원 API 를 쓴다. 회원 조회 `GET /member-service/api-staff/member`, `/member/{id}`(`ROLE_INTERNAL`), 직원 목록·지정·해제 `GET /member-service/api-super/staff`, `PUT|DELETE /member-service/api-super/staff/{memberId}`(`ROLE_SUPER`). 둘 다 `/member-service/` 아래라 Vite proxy·nginx 설정은 그대로다.

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

## 실행 환경

세 콘솔은 dev 의 다른 모든 것과 함께 k8s(modu_infra `k8s/`, 네임스페이스 `modu`)에서 뜬다 — LoadBalancer 로 8081(modu-admin)·8084(modu-system)·8085(modu-internal). nginx 는 게이트웨이를 Service 이름으로만 알고 10초마다 다시 조회한다.

## 이미지와 배포

공식 이미지는 GitHub Actions(`.github/workflows/images.yml`)가 만들어 GHCR 에 올린다. 로컬 `docker build` 와 같은 Dockerfile 이라 어디서 빌드해도 같은 이미지다.

| 콘솔 | 이미지 |
|---|---|
| modu-admin | `ghcr.io/tear94fall/modu-admin/modu-admin` |
| modu-system | `ghcr.io/tear94fall/modu-admin/modu-system` |
| modu-internal | `ghcr.io/tear94fall/modu-admin/modu-internal` |

- 태그: `develop` 푸시 → `develop-<sha7>`, `develop`. `master` 푸시 → `master-<sha7>`, `latest`. PR 은 바뀐 콘솔만 테스트·빌드하고 푸시하지 않는다.
- 바뀐 디렉터리의 콘솔만 빌드한다. `packages/` 나 루트 `package.json`/`package-lock.json` 이 바뀌면 modu-system·modu-internal 둘 다 빌드한다.

배포: dev 는 **k8s**(modu_infra `k8s/`, 네임스페이스 `modu`)에서 돕니다. CI 가 GHCR 에 올린 태그를 `modu_infra/k8s/overlays/dev/kustomization.yaml` 의 `images[].newTag` 에 적고 `kubectl apply -k overlays/dev` 하면 그 Deployment 만 롤링됩니다(빠르게는 `kubectl -n modu set image deploy/<svc> <svc>=<이미지>:<태그>`). 로컬에서 빌드한 이미지를 쓰려면 `docker build -t <이미지>:local <디렉터리>` → `docker save <이미지>:local | docker exec -i desktop-control-plane ctr -n k8s.io images import -` 뒤 태그를 `local` 로 적습니다(Dockerfile 은 CI 와 같은 파일). GHCR 패키지는 저장소가 public 이라 처음 푸시 때부터 public 으로 생깁니다(로그인 없이 pull).
