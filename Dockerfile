FROM node:20-slim

# 安裝 Chromium 依賴
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 設置 Puppeteer 環境變量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝所有依賴（包括 devDependencies 用於構建）
RUN npm ci

# 複製源代碼
COPY . .

# 構建應用
RUN npm run build

# 清理 devDependencies
RUN npm prune --production

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["npm", "start"]
