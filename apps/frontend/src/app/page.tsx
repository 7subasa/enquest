"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Scan } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getUser } from "@/lib/firestore";
import TabNavigation from "@/components/TabNavigation";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import QRScanner from "@/components/QRScanner";
import useEventParticipant from "@/hooks/useEventParticipant";
import { onSnapshot, doc, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildApiUrl } from "@/lib/api";
import ReactMarkdown from "react-markdown";

// AIが生成したテキストを解析してリスト形式に変換
const parseAdviceText = (text: string): string[] => {
  if (!text) return [];
  
  // * で始まる項目を抽出
  const bulletPoints = text.match(/\*\s*[「『]?([^「『」』*]+)[」』]?/g);
  if (bulletPoints) {
    return bulletPoints.map(item => 
      item.replace(/^\*\s*/, '').replace(/[「『」』]/g, '').trim()
    ).filter(item => item.length > 0);
  }
  
  // 改行で分割して空行を除去
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 短い文章の場合はそのまま返す
  if (lines.length === 1 && lines[0].length < 50) {
    return [lines[0]];
  }
  
  return lines;
};

// 簡単なMarkdownコンポーネント
const MarkdownText = ({ children, className = "" }: { children: string; className?: string }) => (
  <div className={`prose prose-sm max-w-none ${className}`}>
    <ReactMarkdown 
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { showToast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [icebreakResult, setIcebreakResult] = useState<any>(null);
  const [showIcebreakDetails, setShowIcebreakDetails] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isGeneratingIcebreak, setIsGeneratingIcebreak] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [icebreakHistory, setIcebreakHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
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
          } else {
            // Fallback: create a temporary short code
            const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            setUserProfile({ shortCode });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // Fallback: create a temporary short code
          const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          setUserProfile({ shortCode });
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const {
    activeEvent,
    isParticipant,
    error: eventError,
  } = useEventParticipant({
    userId: user?.uid,
    role: userProfile?.role ?? null,
    includeParticipant: userProfile?.role !== 'admin',
    autoJoinIfMissing: false,
    enabled: !!user,
  });

  const activeEventId = activeEvent?.id ?? null;
  const userRole = userProfile?.role ?? null;

  useEffect(() => {
    if (eventError) {
      showToast(eventError, 'error');
    }
  }, [eventError, showToast]);

  // スキャン履歴を取得
  useEffect(() => {
    const fetchIcebreakHistory = async () => {
      if (!user || !activeEventId) return;
      if (userRole !== 'admin' && !isParticipant) return;
      
      try {
        const response = await fetch(buildApiUrl(`/events/${activeEventId}/icebreak-history/${user.uid}`));
        if (response.ok) {
          const history = await response.json();
          setIcebreakHistory(history);
        }
      } catch (error) {
        console.log('Failed to fetch icebreak history:', error);
      }
    };
    fetchIcebreakHistory();
  }, [user, activeEventId, isParticipant, userRole]);

  // アイスブレイクセッションのリアルタイム監視
  useEffect(() => {
    if (!currentSessionId || !user) return;
    
    const unsubscribe = onSnapshot(
      doc(db, 'icebreakSessions', currentSessionId),
      (doc) => {
        const data = doc.data();
        if (!data) return;
        
        if (data.status === 'completed' && data.icebreakData) {
          const isInitiator = data.user1Id === user.uid;
          const result = {
            ...data.icebreakData,
            users: {
              user1: { name: data.user1Name },
              user2: { name: data.user2Name }
            },
            role: isInitiator ? 'initiator' : 'responder',
            createdAt: data.createdAt
          };
          console.log('=== FRONTEND DEBUG ===');
          console.log('Current user ID:', user.uid);
          console.log('Session user1Id:', data.user1Id);
          console.log('Session user2Id:', data.user2Id);
          console.log('Is initiator:', isInitiator);
          console.log('Assigned role:', result.role);
          console.log('reverseQuestions exists:', !!result.reverseQuestions);
          console.log('questions exists:', !!result.questions);
          setIcebreakResult(result);
          setIsGeneratingIcebreak(false);
          // 履歴を更新
          setIcebreakHistory(prev => [result, ...prev.slice(0, 9)]);
        } else if (data.status === 'error') {
          showToast('アイスブレイクの生成に失敗しました', 'error');
          setIsGeneratingIcebreak(false);
          setCurrentSessionId(null);
        }
      },
      (error) => {
        console.error('Session monitoring error:', error);
        setIsGeneratingIcebreak(false);
      }
    );
    
    return () => unsubscribe();
  }, [currentSessionId, user, showToast]);

  // 自分宛のアイスブレイクセッションを監視（スキャンされた側）
  useEffect(() => {
    if (!user || !activeEventId) {
      console.log('Skipping user2 session monitoring:', { user: !!user, activeEvent: !!activeEventId });
      return;
    }
    if (userRole !== 'admin' && !isParticipant) {
      return;
    }
    
    console.log('Starting user2 session monitoring for:', user.uid, activeEventId);
    
    const q = query(
      collection(db, 'icebreakSessions'),
      where('user2Id', '==', user.uid),
      where('eventId', '==', activeEventId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('User2 session snapshot received:', snapshot.docs.length, 'documents');
      
      snapshot.docs.forEach(doc => {
        const sessionData = doc.data();
        console.log('Processing session:', doc.id, 'status:', sessionData.status);
        
        if (sessionData.status === 'generating') {
          console.log('Setting generating state for user2');
          setCurrentSessionId(doc.id);
          setIsGeneratingIcebreak(true);
          // 既存の結果をクリア
          setIcebreakResult(null);
        } else if (sessionData.status === 'completed' && sessionData.icebreakData) {
          console.log('Setting completed state for user2');
          setCurrentSessionId(doc.id);
          const result = {
            ...sessionData.icebreakData,
            users: {
              user1: { name: sessionData.user1Name },
              user2: { name: sessionData.user2Name }
            },
            role: 'responder',
            createdAt: sessionData.createdAt
          };
          setIcebreakResult(result);
          setIsGeneratingIcebreak(false);
          // 履歴を更新
          setIcebreakHistory(prev => [result, ...prev.slice(0, 4)]);
        }
      });
    }, (error) => {
      console.error('User2 session monitoring error:', error);
    });
    
    return () => {
      console.log('Cleaning up user2 session monitoring');
      unsubscribe();
    };
  }, [user, activeEventId, isParticipant, userRole]);



  const canAccessEvent = userProfile?.role === 'admin' || isParticipant;

  const handleQRScan = async (scannedData: string) => {
    setShowScanner(false);
    
    if (scannedData === user?.uid || scannedData === userProfile?.shortCode) {
      showToast('自分のコードです', 'info');
      return;
    }

    if (!activeEventId) {
      showToast('アクティブなイベントがありません', 'error');
      return;
    }

    if (!canAccessEvent) {
      showToast('イベントに参加していません', 'error');
      return;
    }

    setIsGeneratingIcebreak(true);
    
    try {
      const isShortCode = /^[A-Z0-9]{6}$/.test(scannedData);
      
      const response = await fetch(buildApiUrl('/icebreak'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user1Id: user?.uid,
          eventId: activeEventId,
          ...(isShortCode ? { user2Code: scannedData } : { user2Id: scannedData })
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Icebreak result:', result);
        
        // セッションIDを保存してリアルタイム監視開始
        if (result.sessionId) {
          setCurrentSessionId(result.sessionId);
        } else {
          // 旧形式の場合は直接表示
          setIcebreakResult(result);
          // 履歴を更新
          if (activeEventId) {
            fetch(buildApiUrl(`/events/${activeEventId}/icebreak-history/${user?.uid}`))
              .then(res => res.json())
              .then(history => setIcebreakHistory(history))
              .catch(err => console.log('Failed to refresh history:', err));
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Icebreak error:', errorData);
        showToast(`アイスブレイクの生成に失敗しました: ${errorData.error}`, 'error');
      }
    } catch (error) {
      showToast('エラーが発生しました', 'error');
    } finally {
      setIsGeneratingIcebreak(false);
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
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-blue-600">EnQuest</h1>
          <Button variant="outline" onClick={logout}>
            ログアウト
          </Button>
        </div>
      </header>
      
      <main className="p-4 space-y-4">
        <div className="text-center py-4">
          <h2 className="text-xl font-semibold mb-2">
            ようこそ、{userProfile?.name || user.email?.split('@')[0]}さん
          </h2>
          {activeEvent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 font-semibold">
                現在開催中: {activeEvent.eventName}
              </p>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <QrCode size={24} />
              マイQRコード
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex justify-center mb-4">
              <QRCodeGenerator value={user.uid} size={200} />
            </div>
            <div className="bg-gray-100 p-3 rounded mb-4">
              <p className="text-xs text-gray-500 mb-1">シェアコード（手動入力用）</p>
              <p className="font-mono text-2xl font-bold text-center text-blue-600">{userProfile?.shortCode || 'Loading...'}</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              このQRコードを相手にスキャンしてもらいましょう
            </p>
          </CardContent>
        </Card>

        <Button 
          className="w-full" 
          size="lg"
          onClick={() => setShowScanner(true)}
          disabled={isGeneratingIcebreak}
        >
          <Scan className="mr-2" size={20} />
          QRコードをスキャン
        </Button>
        
        {isGeneratingIcebreak && (
          <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-700 font-medium">AIがアイスブレイクを生成中...</span>
          </div>
        )}

        {icebreakResult && (
          <Card>
            <CardContent className="p-4">
              {/* コンパクトヘッダー */}
              <div 
                className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                onClick={() => setShowIcebreakDetails(!showIcebreakDetails)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤝</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">アイスブレイクテーマ</p>
                    <p className="text-xs text-gray-600">
                      {icebreakResult.users?.user1?.name || 'ユーザー1'} × {icebreakResult.users?.user2?.name || 'ユーザー2'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    {icebreakResult.role === 'initiator' ? '🗣️' : '👂'}
                  </div>
                  <span className={`transform transition-transform ${showIcebreakDetails ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>

              {/* おすすめ質問例（常に表示） */}
              <div className="mt-3 p-3 bg-white rounded-lg border">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-2">💡 おすすめ質問</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {(() => {
                      const currentQuestions = icebreakResult.role === 'responder' && icebreakResult.reverseQuestions 
                        ? icebreakResult.reverseQuestions 
                        : icebreakResult.questions;
                      
                      const currentTopic = icebreakResult.role === 'initiator' 
                        ? icebreakResult.topic 
                        : icebreakResult.reverseAdvice;
                      
                      if (currentQuestions && currentQuestions.length > 0) {
                        return parseAdviceText(currentQuestions[0])[0] || currentTopic;
                      }
                      return currentTopic;
                    })()
                    }
                  </p>
                </div>
              </div>

              {/* 詳細情報（トグル） */}
              {showIcebreakDetails && (
                <div className="mt-4 space-y-4">
                  {/* ユーザー情報 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {icebreakResult.users?.user1?.name?.charAt(0) || 'A'}
                      </div>
                      <span className="text-sm font-medium">{icebreakResult.users?.user1?.name || 'ユーザー1'}</span>
                    </div>
                    <span className="text-xl">💬</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{icebreakResult.users?.user2?.name || 'ユーザー2'}</span>
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {icebreakResult.users?.user2?.name?.charAt(0) || 'B'}
                      </div>
                    </div>
                  </div>

                  {/* 役割表示 */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    {icebreakResult.role === 'initiator' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🗣️</span>
                        <span className="text-sm text-gray-700">あなたが会話をリードしてください！</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👂</span>
                        <span className="text-sm text-gray-700">相手が会話を始めるのを待ちましょう！</span>
                      </div>
                    )}
                  </div>

                  {/* 会話テーマ */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span>🎯</span>
                      <span className="text-sm">会話テーマ</span>
                    </h3>
                    <div className="text-sm text-gray-700">
                      <MarkdownText>
                        {icebreakResult.role === 'initiator' 
                          ? icebreakResult.topic 
                          : icebreakResult.reverseAdvice}
                      </MarkdownText>
                    </div>
                  </div>

                  {/* コミュニケーションアドバイス */}
                  {(() => {
                    const currentQuestions = icebreakResult.role === 'responder' && icebreakResult.reverseQuestions 
                      ? icebreakResult.reverseQuestions 
                      : icebreakResult.questions;
                    
                    console.log('=== DISPLAY LOGIC DEBUG ===');
                    console.log('Role:', icebreakResult.role);
                    console.log('Is responder:', icebreakResult.role === 'responder');
                    console.log('reverseQuestions available:', !!icebreakResult.reverseQuestions);
                    console.log('Selected questions:', currentQuestions?.slice(0, 2));
                    
                    return currentQuestions && currentQuestions.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <span>💡</span>
                          <span className="text-sm">コミュニケーションアドバイス</span>
                        </h3>
                        <div className="space-y-2">
                          {currentQuestions.flatMap((advice: string, qIndex: number) => 
                            parseAdviceText(advice).map((item: string, itemIndex: number) => (
                              <div key={`${qIndex}-${itemIndex}`} className="p-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded border-l-4 border-blue-400">
                                <div className="flex items-start gap-2">
                                  <span className="text-blue-600 font-semibold text-xs mt-0.5">•</span>
                                  <span className="text-xs text-gray-700">{item}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

              {/* アクションボタン */}
              <div className="mt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowIcebreakDetails(!showIcebreakDetails)}
                >
                  {showIcebreakDetails ? '詳細を隠す' : '詳細を見る'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => setIcebreakResult(null)}
                >
                  閉じる
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {icebreakHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📜</span>
                スキャン履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {icebreakHistory.slice(0, 5).map((item, index) => (
                  <div 
                    key={index} 
                    className="p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setSelectedHistoryItem(item)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          {item.role === 'initiator' && (
                            <span className="text-blue-500" title="スキャンした側">📷</span>
                          )}
                          <span className="font-medium text-blue-600">{item.users?.user1?.name || 'ユーザー1'}</span>
                        </div>
                        <span className="text-gray-400">×</span>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-green-600">{item.users?.user2?.name || 'ユーザー2'}</span>
                          {item.role === 'responder' && (
                            <span className="text-blue-500" title="スキャンした側">📷</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 truncate">
                      <MarkdownText>
                        {item.role === 'initiator' 
                          ? item.topic 
                          : item.reverseAdvice}
                      </MarkdownText>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedHistoryItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedHistoryItem(null)}>
            <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">アイスブレイク詳細</h3>
                  <button 
                    onClick={() => setSelectedHistoryItem(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {selectedHistoryItem.users?.user1?.name?.charAt(0) || 'A'}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          {selectedHistoryItem.role === 'initiator' && (
                            <span className="text-blue-500" title="スキャンした側">📷</span>
                          )}
                          <span className="text-sm font-medium">{selectedHistoryItem.users?.user1?.name || 'ユーザー1'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-2xl">💬</span>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-sm font-medium">{selectedHistoryItem.users?.user2?.name || 'ユーザー2'}</span>
                          {selectedHistoryItem.role === 'responder' && (
                            <span className="text-blue-500" title="スキャンした側">📷</span>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {selectedHistoryItem.users?.user2?.name?.charAt(0) || 'B'}
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-2">会話テーマ</p>
                    <div className="text-lg font-semibold text-gray-800">
                      <MarkdownText>
                        {selectedHistoryItem.role === 'initiator' 
                          ? selectedHistoryItem.topic 
                          : selectedHistoryItem.reverseAdvice}
                      </MarkdownText>
                    </div>
                  </div>
                </div>
                
                {(() => {
                  const currentQuestions = selectedHistoryItem.role === 'responder' && selectedHistoryItem.reverseQuestions 
                    ? selectedHistoryItem.reverseQuestions 
                    : selectedHistoryItem.questions;
                  
                  return currentQuestions && currentQuestions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span>💡</span>
                        コミュニケーションアドバイス
                      </h4>
                      <div className="space-y-2">
                        {currentQuestions.flatMap((advice: string, qIndex: number) => 
                          parseAdviceText(advice).map((item: string, itemIndex: number) => (
                            <div key={`${qIndex}-${itemIndex}`} className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-l-4 border-blue-400 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="text-blue-600 font-semibold text-xs mt-0.5">•</span>
                                <span className="text-gray-700">{item}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                <div className="text-xs text-gray-500 text-center">
                  {selectedHistoryItem.createdAt ? new Date(selectedHistoryItem.createdAt).toLocaleString('ja-JP') : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showScanner && (
        <QRScanner 
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <TabNavigation />
    </div>
  );
}
