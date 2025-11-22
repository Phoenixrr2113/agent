FROM node:20-alpine
RUN apk add --no-cache git python3 py3-pip
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
RUN pip3 install mcp-server-fetch --break-system-packages
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
