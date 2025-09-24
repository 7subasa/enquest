export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold text-blue-600">ページが見つかりません</h1>
        <p className="text-gray-600">URLが正しいか確認するか、トップページへ戻ってください。</p>
      </div>
    </div>
  );
}
