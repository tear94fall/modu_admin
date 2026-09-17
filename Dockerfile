# 1단계: 정적 파일 빌드. API 주소는 비워 두어(상대 경로) nginx 프록시를 타게 한다.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=""
RUN npm run build

# 2단계: nginx 가 정적 파일을 서빙하고 서비스 경로는 게이트웨이로 넘긴다.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
