# 빌드 컨텍스트는 레포 루트다(공통 패키지 packages/console-core 가 필요하다). docker-compose.yml 참고.
# 1단계: npm 워크스페이스로 설치하고 이 앱만 빌드한다. API 는 상대 경로라 nginx 프록시를 탄다.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/console-core/package.json packages/console-core/
COPY modu-system/package.json modu-system/
COPY modu-internal/package.json modu-internal/
RUN npm ci
COPY packages packages
COPY modu-internal modu-internal
RUN npm run build -w modu-internal

# 2단계: nginx 가 정적 파일을 서빙하고 게이트웨이 경로를 넘긴다. upstream resolve 는 nginx 1.27.3 이상이 필요하다.
FROM nginx:1.27-alpine
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY modu-internal/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/modu-internal/dist /usr/share/nginx/html
EXPOSE 80
