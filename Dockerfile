FROM node:20-slim

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

# 創建 auth 目錄
RUN mkdir -p .baileys_auth

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["npm", "start"]
