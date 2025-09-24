"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/contexts/ToastContext";
import { buildApiUrl } from "@/lib/api";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { showToast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl('/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        showToast(`登録完了！シェアコード: ${result.shortCode}`, 'success');
        router.push("/login");
      } else {
        const errorData = await response.text();
        setError(errorData || "登録に失敗しました");
        showToast(errorData || "登録に失敗しました", 'error');
      }
    } catch (error) {
      setError("エラーが発生しました");
      showToast("エラーが発生しました", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      <main className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold text-blue-600">EnQuest</CardTitle>
            <p className="text-sm text-gray-600">招待制アプリ - 管理者からの招待が必要です</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">名前</Label>
                  <Input 
                    id="name"
                    name="name"
                    placeholder="山田太郎" 
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input 
                    id="email"
                    name="email"
                    type="email" 
                    placeholder="name@example.com" 
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">パスワード</Label>
                  <Input 
                    id="password"
                    name="password"
                    type="password" 
                    placeholder="********" 
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="department">部署</Label>
                  <Input 
                    id="department"
                    name="department"
                    placeholder="開発部" 
                    value={formData.department}
                    onChange={handleChange}
                    required
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "登録中..." : "登録"}
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push("/login")}
            >
              ログインに戻る
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
