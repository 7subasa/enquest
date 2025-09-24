"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, LogOut, Building, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getUser, User as UserType } from "@/lib/firestore";
import TabNavigation from "@/components/TabNavigation";
import SurveyModal from "@/components/SurveyModal";
import { buildApiUrl } from "@/lib/api";
import useEventParticipant from "@/hooks/useEventParticipant";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserType | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    department: '',
    email: '',
    age: '',
    gender: '',
    favoriteFood: '',
    hobbies: '',
    hometown: '',
    musicGenre: '',
    currentInterest: '',
    message: ''
  });
  const router = useRouter();
  const { showToast } = useToast();

  const {
    activeEvent,
    participant,
    error: eventError,
    refresh,
  } = useEventParticipant({
    userId: user?.uid,
    role: userProfile?.role ?? null,
    includeParticipant: true,
    autoJoinIfMissing: false,
    enabled: !!user,
  });
  const participantData = participant;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (eventError) {
      showToast(eventError, 'error');
    }
  }, [eventError, showToast]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const profile = await getUser(user.uid);
        setUserProfile(profile);
      }
    };
    fetchUserProfile();
  }, [user]);
  
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        name: userProfile.name || '',
        department: userProfile.department || '',
        email: userProfile.email || '',
        age: userProfile.age || '',
        gender: userProfile.gender || '',
        favoriteFood: userProfile.favoriteFood || '',
        hobbies: userProfile.hobbies || '',
        hometown: userProfile.hometown || '',
        musicGenre: userProfile.musicGenre || '',
        currentInterest: userProfile.currentInterest || '',
        message: userProfile.message || ''
      });
    }
  }, [userProfile]);
  
  const handleProfileUpdate = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(buildApiUrl(`/users/${user.uid}/profile`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      
      if (response.ok) {
        const profile = await getUser(user.uid);
        setUserProfile(profile);
        setShowProfileEdit(false);
        showToast('プロフィールを更新しました！', 'success');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('プロフィールの更新に失敗しました', 'error');
    }
  };

  const handleSurveySubmit = async (answers: { question: string; answer: string }[]) => {
    if (!user || !activeEvent) return;

    try {
      const response = await fetch(buildApiUrl(`/events/${activeEvent.id}/participants/me/answers`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          answers
        }),
      });

      if (response.ok) {
        setShowSurvey(false);
        await refresh();
        showToast('アンケートを送信しました', 'success');
      } else {
        showToast('アンケートの送信に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      showToast('アンケートの送信に失敗しました', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white shadow-sm border-b">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-blue-600 text-center">プロフィール</h1>
        </div>
      </header>
      
      <main className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={24} />
              ユーザー情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {userProfile?.name && (
              <div className="flex items-center gap-3">
                <User size={20} className="text-gray-500" />
                <span>{userProfile.name}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-gray-500" />
              <span>{user.email}</span>
            </div>
            {userProfile?.department && (
              <div className="flex items-center gap-3">
                <Building size={20} className="text-gray-500" />
                <span>{userProfile.department}</span>
              </div>
            )}
            <div className="text-sm text-gray-600">
              役割: {userProfile?.role === 'admin' ? '管理者' : '参加者'}
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-3"
              onClick={() => setShowProfileEdit(true)}
            >
              プロフィール編集
            </Button>
          </CardContent>
        </Card>
        
        {userProfile && (
          <Card>
            <CardHeader>
              <CardTitle>プロフィール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userProfile.age && (
                <div className="flex justify-between">
                  <span className="text-gray-600">年齢:</span>
                  <span>{userProfile.age}</span>
                </div>
              )}
              {userProfile.gender && (
                <div className="flex justify-between">
                  <span className="text-gray-600">性別:</span>
                  <span>{userProfile.gender}</span>
                </div>
              )}
              {userProfile.favoriteFood && (
                <div className="flex justify-between">
                  <span className="text-gray-600">好きな食べ物:</span>
                  <span>{userProfile.favoriteFood}</span>
                </div>
              )}
              {userProfile.hobbies && (
                <div className="flex justify-between">
                  <span className="text-gray-600">趣味:</span>
                  <span>{userProfile.hobbies}</span>
                </div>
              )}
              {userProfile.hometown && (
                <div className="flex justify-between">
                  <span className="text-gray-600">出身地:</span>
                  <span>{userProfile.hometown}</span>
                </div>
              )}
              {userProfile.message && (
                <div>
                  <div className="text-gray-600 mb-1">一言メッセージ:</div>
                  <div className="bg-gray-50 p-2 rounded text-sm">{userProfile.message}</div>
                </div>
              )}
              {!userProfile.age && !userProfile.gender && !userProfile.favoriteFood && (
                <div className="text-center text-gray-500 py-4">
                  プロフィールを設定して交流をより楽しみましょう！
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>イベント参加状況</CardTitle>
          </CardHeader>
          <CardContent>
            {activeEvent ? (
              <div className="space-y-3">
                <div>
                  <strong>{activeEvent.eventName}</strong>
                  <div className="text-sm text-gray-600">{activeEvent.eventDate}</div>
                </div>
                
                {participantData && (!participantData.answers || Object.keys(participantData.answers).length === 0) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-800 mb-2">
                      <FileText size={16} />
                      <span className="font-medium">アンケート未回答</span>
                    </div>
                    <p className="text-sm text-yellow-700 mb-3">
                      より良い交流のために、アンケートにご回答ください。
                    </p>
                    <Button 
                      onClick={() => setShowSurvey(true)}
                      className="w-full"
                      size="sm"
                    >
                      アンケートに回答する
                    </Button>
                  </div>
                )}
                
                {participantData && participantData.answers && Object.keys(participantData.answers).length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-green-800 font-medium mb-1">アンケート回答済み</div>
                    <div className="text-sm text-green-700">
                      ありがとうございます！交流をお楽しみください。
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-600">
                参加中のイベントはありません
              </div>
            )}
          </CardContent>
        </Card>

        {userProfile?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>管理者機能</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => router.push('/admin')}
              >
                管理者ダッシュボード
              </Button>
            </CardContent>
          </Card>
        )}

        <Button 
          variant="destructive" 
          className="w-full" 
          onClick={logout}
        >
          <LogOut className="mr-2" size={20} />
          ログアウト
        </Button>
      </main>

      <TabNavigation />
      
      {activeEvent && (
        <SurveyModal
          isOpen={showSurvey}
          onClose={() => setShowSurvey(false)}
          onSubmit={handleSurveySubmit}
          questions={activeEvent.surveyQuestions || []}
        />
      )}
      
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">プロフィール編集</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">名前</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="山田太郎"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">部署</label>
                <input
                  type="text"
                  value={profileForm.department}
                  onChange={(e) => setProfileForm({...profileForm, department: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="営業部、開発部など"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="example@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">年齢（任意）</label>
                <input
                  type="text"
                  value={profileForm.age}
                  onChange={(e) => setProfileForm({...profileForm, age: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="20代などでもOK"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">性別</label>
                <select
                  value={profileForm.gender}
                  onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">選択してください</option>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">好きな食べ物</label>
                <input
                  type="text"
                  value={profileForm.favoriteFood}
                  onChange={(e) => setProfileForm({...profileForm, favoriteFood: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="ラーメン、スイーツなど"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">趣味・興味</label>
                <input
                  type="text"
                  value={profileForm.hobbies}
                  onChange={(e) => setProfileForm({...profileForm, hobbies: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="読書、映画鑑賞など"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">出身地</label>
                <input
                  type="text"
                  value={profileForm.hometown}
                  onChange={(e) => setProfileForm({...profileForm, hometown: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="東京、大阪など"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">一言メッセージ</label>
                <textarea
                  value={profileForm.message}
                  onChange={(e) => setProfileForm({...profileForm, message: e.target.value})}
                  className="w-full p-2 border rounded h-20 resize-none"
                  placeholder="よろしくお願いします！"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button onClick={handleProfileUpdate} className="flex-1">
                保存
              </Button>
              <Button variant="outline" onClick={() => setShowProfileEdit(false)} className="flex-1">
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
