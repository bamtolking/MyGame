# 전용 서버(정적 파일 + WebSocket 방) 컨테이너. docker build -t nrd . && docker run -p 8080:8080 nrd
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build
ENV PORT=8080 STATIC_DIR=/app/dist
EXPOSE 8080
CMD ["node", "server/index.ts"]
