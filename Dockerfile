FROM node:18

WORKDIR /usr/src/app

# パッケージファイルをコピー
COPY apps/backend/package*.json ./

# 依存関係をインストール
RUN npm install

# アプリケーションコードをコピー
COPY apps/backend/ ./

# TypeScriptをビルド
RUN npm run build

# ポート8080を公開
EXPOSE 8080

# 環境変数設定
ENV NODE_ENV=production
ENV PORT=8080

# アプリケーション起動
CMD ["npm", "start"]