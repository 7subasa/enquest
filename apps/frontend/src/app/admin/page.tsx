"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Calendar, BarChart3, Trash2, Eye, Settings, Lightbulb, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { buildApiUrl } from "@/lib/api";

interface Event {
  id: string;
  eventName: string;
  isActive: boolean;
  participantCount?: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState({ totalEvents: 0, activeEvents: 0, uniqueParticipants: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showUserManagement, setShowUserManagement] = useState(false);
  // アンケートデフォルト項目
  const [newEvent, setNewEvent] = useState({ 
    eventName: "",
    surveyQuestions: [
      { id: 1, question: "好きな食べ物" },
      { id: 2, question: "最近ハマっていること" }
    ]
  });
  const [participants, setParticipants] = useState<any[]>([]);
  const [showParticipants, setShowParticipants] = useState<string>('');
  const [showBingoStatus, setShowBingoStatus] = useState<string>('');
  const [bingoStatus, setBingoStatus] = useState<any[]>([]);
  const [showPhotos, setShowPhotos] = useState<string>('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [showQuestionSettings, setShowQuestionSettings] = useState<string>('');
  const [editingQuestions, setEditingQuestions] = useState<{ id: number; question: string }[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiQuestionCount, setAiQuestionCount] = useState(3);
  const [showScanHistory, setShowScanHistory] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const response = await fetch(buildApiUrl(`/users/${user.uid}`));
          if (response.ok) {
            const profile = await response.json();
            setUserProfile(profile);
            if (profile.role !== 'admin') {
              router.push('/');
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          router.push('/');
        }
      }
    };
    fetchUserProfile();
  }, [user, router]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // イベントの取得
        const response = await fetch(buildApiUrl('/events'));
        if (response.ok) {
          const eventsData = await response.json();
          setEvents(eventsData);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    
    // ユーザー情報の取得
    const fetchUsers = async () => {
      try {
        const response = await fetch(buildApiUrl('/users'));
        if (response.ok) {
          const usersData = await response.json();
          setUsers(usersData);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    
    // ダッシュボード統計の取得
    const fetchDashboardStats = async () => {
      try {
        const response = await fetch(buildApiUrl('/admin/stats'));
        if (response.ok) {
          const statsData = await response.json();
          setDashboardStats(statsData);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };
    
    fetchEvents();
    fetchUsers();
    fetchDashboardStats();
  }, []);

  // イベントの作成
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(buildApiUrl('/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });
      
      if (response.ok) {
        setShowCreateForm(false);
        setNewEvent({ 
          eventName: "",
          surveyQuestions: [
            { id: 1, question: "好きな食べ物" },
            { id: 2, question: "最近ハマっていること" }
          ]
        });
        // Refresh events list
        const eventsResponse = await fetch(buildApiUrl('/events'));
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData);
        }
      }
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleAddParticipant = async (eventId: string) => {
    if (selectedUserIds.length === 0) {
      showToast('参加者を選択してください', 'error');
      return;
    }
    
    try {
      // 参加者招待
      const promises = selectedUserIds.map(userId => 
        fetch(buildApiUrl(`/events/${eventId}/participants`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
      );
      
      await Promise.all(promises);
      
      const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
      const userNames = selectedUsers.map(u => u.name).join(', ');
      showToast(`${userNames}さんをイベントに招待しました！`, 'success');
      setShowAddParticipants('');
      setSelectedUserIds([]);
      // 参加者一覧を再取得
      fetchParticipants(eventId);
    } catch (error) {
      console.error('Error adding participants:', error);
      showToast('参加者の追加に失敗しました', 'error');
    }
  };

  // 参加者選択
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // イベントのアクティブ/非アクティブ切替
  const toggleEventStatus = async (eventId: string, isActive: boolean) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      
      if (response.ok) {
        setEvents(events.map(event => 
          event.id === eventId ? { ...event, isActive: !isActive } : event
        ));
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  // イベントの削除
  const deleteEvent = async (eventId: string) => {
    if (!window.confirm('イベントを削除しますか？')) return;
    
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}`), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setEvents(events.filter(event => event.id !== eventId));
        showToast('イベントを削除しました', 'success');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('イベントの削除に失敗しました', 'error');
    }
  };

  // 参加者一覧の取得
  const fetchParticipants = async (eventId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/participants`));
      if (response.ok) {
        const participantsData = await response.json();
        setParticipants(participantsData);
        setShowParticipants(eventId);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };
  
  // ビンゴ状況の取得
  const fetchBingoStatus = async (eventId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/bingo-status`));
      if (response.ok) {
        const bingoData = await response.json();
        setBingoStatus(bingoData);
        setShowBingoStatus(eventId);
      }
    } catch (error) {
      console.error('Error fetching bingo status:', error);
    }
  };

  // 画像の取得
  const fetchPhotos = async (eventId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/photos`));
      if (response.ok) {
        const photosData = await response.json();
        setPhotos(photosData);
        setShowPhotos(eventId);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  // スキャン履歴の取得
  const fetchScanHistory = async (eventId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/admin/icebreak-sessions`));
      if (response.ok) {
        const historyData = await response.json();
        setScanHistory(historyData);
        setShowScanHistory(eventId);
      }
    } catch (error) {
      console.error('Error fetching scan history:', error);
    }
  };

  // 参加者の削除
  const removeParticipant = async (eventId: string, userId: string) => {
    if (!window.confirm('参加者を削除しますか？')) return;
    
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/participants/${userId}`), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setParticipants(participants.filter(p => p.userId !== userId));
        showToast('参加者を削除しました', 'success');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      showToast('参加者の削除に失敗しました', 'error');
    }
  };

  // アンケート質問の更新
  const updateEventQuestions = async (eventId: string, questions: { id: number; question: string }[]) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyQuestions: questions })
      });
      
      if (response.ok) {
        setEvents(events.map(event => 
          event.id === eventId ? { ...event, surveyQuestions: questions } : event
        ));
        setShowQuestionSettings('');
        showToast('アンケート質問を更新しました', 'success');
      }
    } catch (error) {
      console.error('Error updating questions:', error);
      showToast('質問の更新に失敗しました', 'error');
    }
  };

  // 質問の追加・削除・編集
  const addQuestion = () => {
    const newId = Math.max(...editingQuestions.map(q => q.id), 0) + 1;
    setEditingQuestions([...editingQuestions, { id: newId, question: '' }]);
  };

  // 質問の削除
  const removeQuestion = (id: number) => {
    setEditingQuestions(editingQuestions.filter(q => q.id !== id));
  };

  // 質問の編集
  const updateQuestion = (id: number, question: string) => {
    setEditingQuestions(editingQuestions.map(q => 
      q.id === id ? { ...q, question } : q
    ));
  };

  // AIによる質問提案
  const generateAISuggestions = async () => {
    const currentEvent = events.find(e => e.id === showQuestionSettings);
    if (!currentEvent) return;

    setIsGeneratingAI(true);
    try {
      const response = await fetch(buildApiUrl('/ai/suggest-questions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          eventName: currentEvent.eventName,
          eventType: 'communication',
          count: aiQuestionCount
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const newQuestions = data.questions.map((q: any, index: number) => ({
          id: Math.max(...editingQuestions.map(eq => eq.id), 0) + index + 1,
          question: typeof q === 'string' ? q : q.question
        }));
        setEditingQuestions(prev => [...prev, ...newQuestions]);
        showToast('AIが質問を追加提案しました！', 'success');
      } else {
        showToast('AI提案の取得に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      showToast('AI提案の取得に失敗しました', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // ビンゴミッション生成
  const generateBingoMissions = async (eventId: string, userId: string) => {
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/participants/${userId}/regenerate-bingo`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        showToast('ビンゴミッションを生成しました！', 'success');
        // ビンゴ状況を再取得
        if (showBingoStatus === eventId) {
          fetchBingoStatus(eventId);
        }
      } else {
        showToast('ビンゴミッションの生成に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error generating bingo missions:', error);
      showToast('ビンゴミッションの生成に失敗しました', 'error');
    }
  };

  // 一括ビンゴミッション生成
  const generateAllBingoMissions = async (eventId: string) => {
    if (!window.confirm('全参加者のビンゴミッションを一括生成しますか？\n（既存の進捗はリセットされます）')) {
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl(`/events/${eventId}/regenerate-all-bingo`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        showToast(`一括生成完了: 成功${data.summary.success}件、エラー${data.summary.errors}件`, 'success');
        // ビンゴ状況を再取得
        if (showBingoStatus === eventId) {
          fetchBingoStatus(eventId);
        }
      } else {
        showToast('一括生成に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error generating all bingo missions:', error);
      showToast('一括生成に失敗しました', 'error');
    }
  };

  // ユーザー権限更新
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(buildApiUrl(`/users/${userId}/role`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        showToast('ユーザー権限を更新しました', 'success');
      } else {
        showToast('権限更新に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      showToast('権限更新に失敗しました', 'error');
    }
  };

  // ユーザー削除
  const deleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`${userName}さんを削除しますか？\n（この操作は元に戻せません）`)) {
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl(`/users/${userId}`), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
        showToast(`${userName}さんを削除しました`, 'success');
      } else {
        showToast('ユーザー削除に失敗しました', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('ユーザー削除に失敗しました', 'error');
    }
  };

  // 質問設定の開始
  const startEditingQuestions = (event: Event) => {
    setEditingQuestions((event as any).surveyQuestions || [
      { id: 1, question: '好きな食べ物' },
      { id: 2, question: '最近ハマっていること' }
    ]);
    setShowQuestionSettings(event.id);
  };

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (userProfile.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <header className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-600">管理者ダッシュボード</h1>
          <Button variant="outline" onClick={() => router.push('/')}>
            ホームに戻る
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総イベント数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalEvents}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブイベント</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.activeEvents}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総参加者数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.uniqueParticipants}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>イベント管理</CardTitle>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2" size={16} />
              新規イベント作成
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <form onSubmit={handleCreateEvent} className="mb-4 p-4 border rounded-lg">
              <div className="mb-4">
                <Label htmlFor="eventName">イベント名</Label>
                <Input
                  id="eventName"
                  value={newEvent.eventName}
                  onChange={(e) => setNewEvent({...newEvent, eventName: e.target.value})}
                  required
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit">作成</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  キャンセル
                </Button>
              </div>
            </form>
          )}
          
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="border rounded-lg">
                <div className="p-3">
                  <div className="mb-2">
                    <h3 className="font-semibold">{event.eventName}</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs w-fit ${
                      event.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {event.isActive ? 'アクティブ' : '非アクティブ'}
                    </span>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditingQuestions(event)}
                        className="text-xs px-2 py-1"
                      >
                        <Settings size={12} className="mr-1" />
                        質問
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchParticipants(event.id)}
                        className="text-xs px-2 py-1"
                      >
                        <Eye size={12} className="mr-1" />
                        参加者
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchBingoStatus(event.id)}
                        className="text-xs px-2 py-1"
                      >
                        🎯 ビンゴ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchPhotos(event.id)}
                        className="text-xs px-2 py-1"
                      >
                        <Camera size={12} className="mr-1" />
                        画像
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchScanHistory(event.id)}
                        className="text-xs px-2 py-1"
                      >
                        📱 スキャン履歴
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleEventStatus(event.id, event.isActive)}
                        className="text-xs px-2 py-1"
                      >
                        {event.isActive ? '停止' : '開始'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteEvent(event.id)}
                        className="text-xs px-2 py-1"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {showQuestionSettings === event.id && (
                  <div className="border-t p-3 bg-gray-50">
                    <div className="mb-4">
                      <h4 className="font-semibold mb-3">アンケート質問設定</h4>
                      <div className="bg-blue-50 p-3 rounded-lg mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-blue-700">AI質問生成:</span>
                          <div className="flex items-center gap-2">
                            {[1,2,3,4,5].map(num => (
                              <button
                                key={num}
                                onClick={() => setAiQuestionCount(num)}
                                disabled={isGeneratingAI}
                                className={`px-3 py-1 text-sm rounded border ${
                                  aiQuestionCount === num 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                } ${isGeneratingAI ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {num}個
                              </button>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            onClick={generateAISuggestions}
                            disabled={isGeneratingAI}
                            className="ml-2"
                          >
                            {isGeneratingAI ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                                生成中...
                              </>
                            ) : (
                              <>
                                <Lightbulb size={16} className="mr-1" />
                                質問を追加
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">イベント前の参加者コミュニケーション促進用の質問を生成します</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      {editingQuestions.map((q) => (
                        <div key={q.id} className="flex items-center gap-2">
                          <Input
                            value={q.question}
                            onChange={(e) => updateQuestion(q.id, e.target.value)}
                            placeholder="質問を入力"
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addQuestion}>
                        <Plus size={16} className="mr-1" />
                        質問追加
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => updateEventQuestions(event.id, editingQuestions)}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowQuestionSettings('')}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                )}
                
                {showParticipants === event.id && (
                  <div className="border-t p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold">参加者一覧</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setShowAddParticipants(event.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Plus size={16} className="mr-1" />
                          参加者追加
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowParticipants('')}
                        >
                          閉じる
                        </Button>
                      </div>
                    </div>
                    
                    {showAddParticipants === event.id && (
                      <div className="mb-4 p-3 border rounded-lg bg-white">
                        <h5 className="font-medium mb-2">参加者を選択</h5>
                        <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1 mb-3">
                          {users.filter(user => !participants.some(p => p.userId === user.id)).map((user) => (
                            <label key={user.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={() => toggleUserSelection(user.id)}
                                className="rounded"
                              />
                              <span className="text-sm">{user.name} ({user.department}) {user.role === 'admin' && '👑'}</span>
                            </label>
                          ))}
                        </div>
                        {selectedUserIds.length > 0 && (
                          <div className="text-sm text-blue-600 mb-2">
                            {selectedUserIds.length}人選択中
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAddParticipant(event.id)}>追加</Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setShowAddParticipants('');
                            setSelectedUserIds([]);
                          }}>キャンセル</Button>
                        </div>
                      </div>
                    )}
                    
                    {participants.length === 0 ? (
                      <p className="text-sm text-gray-600">参加者はいません</p>
                    ) : (
                      <div className="space-y-1">
                        {participants.map((participant) => (
                          <div key={participant.userId} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm">{participant.userName}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeParticipant(event.id, participant.userId)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {showBingoStatus === event.id && (
                  <div className="border-t p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold">ビンゴ状況</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => generateAllBingoMissions(event.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          🎯 一括生成
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowBingoStatus('')}
                        >
                          閉じる
                        </Button>
                      </div>
                    </div>
                    {bingoStatus.length === 0 ? (
                      <p className="text-sm text-gray-600">ビンゴデータがありません</p>
                    ) : (
                      <div className="space-y-2">
                        {bingoStatus.map((status) => (
                          <div key={status.userId} className="p-3 bg-white rounded border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{status.userName}</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateBingoMissions(event.id, status.userId)}
                                  className="text-xs"
                                >
                                  🎯 ミッション生成
                                </Button>
                                {status.hasBingo && (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                    🏆 ビンゴ達成
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${status.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                {status.completedCount}/{status.totalCount}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 mb-2">
                              {status.bingoCompleted.map((completed: boolean, index: number) => (
                                <div
                                  key={index}
                                  className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                                    completed ? 'bg-green-500 text-white' : 'bg-gray-200'
                                  }`}
                                >
                                  {index + 1}
                                </div>
                              ))}
                            </div>
                            {status.bingoReady && status.bingoBoard && status.bingoBoard.length > 0 && (
                              <div className="mt-2">
                                <h5 className="text-xs font-medium text-gray-700 mb-1">ミッション一覧:</h5>
                                <div className="grid grid-cols-1 gap-1 text-xs">
                                  {status.bingoBoard.map((mission: any, index: number) => {
                                    const missionText = typeof mission === 'string' ? mission : mission.text;
                                    const missionType = typeof mission === 'string' ? 'talk' : mission.type;
                                    const typeIcon = {
                                      talk: '💬',
                                      photo: '📷',
                                      find: '🔍',
                                      experience: '✨'
                                    }[missionType] || '💬';
                                    
                                    return (
                                      <div key={index} className="flex items-center gap-1">
                                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${
                                          status.bingoCompleted[index] ? 'bg-green-500 text-white' : 'bg-gray-200'
                                        }`}>
                                          {index + 1}
                                        </span>
                                        <span className="text-xs mr-1">{typeIcon}</span>
                                        <span className={status.bingoCompleted[index] ? 'line-through text-gray-500' : ''}>
                                          {missionText}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {!status.bingoReady && (
                              <div className="mt-2 text-xs text-orange-600">
                                ⚠️ ミッション未生成 - 「ミッション生成」ボタンをクリックしてください
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {showPhotos === event.id && (
                  <div className="border-t p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold">アップロード画像</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowPhotos('')}
                      >
                        閉じる
                      </Button>
                    </div>
                    {photos.length === 0 ? (
                      <p className="text-sm text-gray-600">アップロードされた画像がありません</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {photos.map((photo, index) => (
                          <div key={index} className="bg-white rounded-lg border p-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPhoto(photo)}>
                            <div className="mb-2">
                              <div className="text-xs font-medium truncate">{photo.userName}</div>
                              <div className="text-xs text-gray-500 truncate">ミッション {photo.bingoIndex + 1}</div>
                            </div>
                            <img 
                              src={photo.imageData} 
                              alt={`${photo.userName}のミッション${photo.bingoIndex + 1}`}
                              className="w-full aspect-square object-cover rounded border"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {showScanHistory === event.id && (
                  <div className="border-t p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold">スキャン履歴</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowScanHistory('')}
                      >
                        閉じる
                      </Button>
                    </div>
                    {scanHistory.length === 0 ? (
                      <p className="text-sm text-gray-600">スキャン履歴がありません</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {scanHistory.map((session, index) => (
                          <div key={session.id} className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="flex items-center gap-1">
                                  <span className="text-blue-500" title="スキャンした側">📷</span>
                                  <span className="font-medium text-blue-600">{session.user1Name}</span>
                                </div>
                                <span className="text-gray-400">×</span>
                                <span className="font-medium text-green-600">{session.user2Name}</span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {session.createdAt ? new Date(session.createdAt).toLocaleString('ja-JP', { 
                                  month: '2-digit', 
                                  day: '2-digit', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                }) : ''}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 truncate">{session.topic}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>ユーザー管理</CardTitle>
            <Button onClick={() => setShowUserManagement(!showUserManagement)}>
              <Users className="mr-2" size={16} />
              ユーザー一覧
            </Button>
          </div>
        </CardHeader>
        {showUserManagement && (
          <CardContent>
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-white rounded border gap-2">
                  <div>
                    <span className="font-medium">{user.name}</span>
                    <span className="text-sm text-gray-600 ml-2">({user.department})</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? '👑 管理者' : '👤 参加者'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant={user.role === 'admin' ? 'outline' : 'default'}
                      className={`text-xs ${user.role === 'admin' ? '' : 'bg-purple-600 hover:bg-purple-700 text-white font-semibold'}`}
                      onClick={() => updateUserRole(user.id, user.role === 'admin' ? 'participant' : 'admin')}
                    >
                      {user.role === 'admin' ? '参加者に変更' : '👑 管理者に変更'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(user.id, user.name)}
                      className="text-xs"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3">
              <div className="text-lg font-medium">{selectedPhoto.userName}</div>
              <div className="text-sm text-gray-600">ミッション {selectedPhoto.bingoIndex + 1}: {selectedPhoto.missionText}</div>
              <div className="text-sm text-gray-500">{new Date(selectedPhoto.uploadedAt).toLocaleString('ja-JP')}</div>
            </div>
            <img 
              src={selectedPhoto.imageData} 
              alt={`${selectedPhoto.userName}のミッション${selectedPhoto.bingoIndex + 1}`}
              className="w-full max-h-96 object-contain rounded border"
            />
            <Button className="mt-3 w-full" onClick={() => setSelectedPhoto(null)}>閉じる</Button>
          </div>
        </div>
      )}

    </div>
  );
}
