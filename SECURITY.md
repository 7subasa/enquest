# セキュリティガイドライン

## 🚨 重要な注意事項

### 絶対にコミットしてはいけないファイル
- `serviceAccountKey.json` - Firebase/GCP認証情報
- `.env` - 環境変数ファイル
- 任意のAPIキーや秘密鍵

### 安全なデプロイ方法

#### 開発環境
```bash
# 1. serviceAccountKey.jsonを安全な場所に配置
cp path/to/serviceAccountKey.json apps/backend/

# 2. 環境変数設定
cp .env.example .env.local
# .env.localを編集して実際の値を設定
```

#### 本番環境（GCP）
```bash
# Cloud Runでは環境変数またはSecret Managerを使用
gcloud run deploy --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=enquest-app"
```

## デプロイ前チェックリスト
- [ ] .gitignoreにserviceAccountKey.jsonが含まれている
- [ ] 環境変数が正しく設定されている
- [ ] 秘密情報がコードに直接書かれていない

## 問題が発生した場合
1. 即座にGCPコンソールでサービスアカウントキーを無効化
2. 新しいキーを生成
3. 影響範囲を調査