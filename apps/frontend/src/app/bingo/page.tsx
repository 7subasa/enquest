"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import TabNavigation from "@/components/TabNavigation";
import useEventParticipant from "@/hooks/useEventParticipant";
import { buildApiUrl } from "@/lib/api";

export default function BingoPage() {
  const { user, loading } = useAuth();
  const [completedItems, setCompletedItems] = useState<boolean[]>(new Array(9).fill(false));
  const [hasBingo, setHasBingo] = useState<boolean>(false);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoIndex, setUndoIndex] = useState<number>(-1);
  const [bingoItems, setBingoItems] = useState<Array<{text: string, type: string}>>([
    { text: "同じ部署の人と話す", type: "talk" },
    { text: "趣味が同じ人とツーショット写真を撮る", type: "photo" },
    { text: "出身地が同じ人を見つける", type: "find" },
    { text: "好きな食べ物が同じ人と話す", type: "talk" },
    { text: "同じ年代の人と写真を撮る", type: "photo" },
    { text: "ペットを飼っている人を探す", type: "find" },
    { text: "海外旅行好きな人と話す", type: "talk" },
    { text: "スポーツ好きな人と一緒にポーズをとる", type: "photo" },
    { text: "読書好きな人と本の話をする", type: "talk" }
  ]);
  const [bingoReady, setBingoReady] = useState<boolean>(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState<number>(-1);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const router = useRouter();
  const { showToast } = useToast();

  const {
    activeEvent,
    participant,
    isParticipant,
    error: eventError,
    refresh,
  } = useEventParticipant({
    userId: user?.uid,
    includeParticipant: true,
    autoJoinIfMissing: true,
    enabled: !!user,
  });
  const activeEventId = activeEvent?.id ?? null;
  const participantData = participant;

  useEffect(() => {
    if (eventError) {
      showToast(eventError, 'error');
    }
  }, [eventError, showToast]);

  useEffect(() => {
    if (!participantData) return;

    if (Array.isArray(participantData.bingoBoard) && participantData.bingoBoard.length > 0) {
      const missions = participantData.bingoBoard.map((item: any) => {
        if (typeof item === 'string') {
          return { text: item, type: 'talk' };
        }
        return item;
      });
      setBingoItems(missions);
    }

    if (Array.isArray(participantData.bingoCompleted) && participantData.bingoCompleted.length === 9) {
      setCompletedItems(participantData.bingoCompleted);
    }

    if (typeof participantData.bingoReady === 'boolean') {
      setBingoReady(participantData.bingoReady);
    }
  }, [participantData]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchBingoState = async () => {
      if (!user || !activeEventId || !isParticipant) return;
      
      try {
        const response = await fetch(buildApiUrl(`/events/${activeEventId}/participants/${user.uid}/bingo`));
        if (response.ok) {
          const data = await response.json();
          setCompletedItems(data.bingoCompleted);
          setHasBingo(data.hasBingo);
          setBingoReady(data.bingoReady);
          if (data.bingoBoard.length > 0) {
            // 旧形式の文字列配列を新形式に変換
            const missions = data.bingoBoard.map((item: any) => {
              if (typeof item === 'string') {
                return { text: item, type: 'talk' };
              }
              return item;
            });
            setBingoItems(missions);
          }
        }
      } catch (error) {
        console.error('Error fetching bingo state:', error);
      }
    };
    
    fetchBingoState();
  }, [user, activeEventId, isParticipant]);

  const toggleItem = async (index: number) => {
    if (!user || !activeEventId) return;
    if (!isParticipant) {
      showToast('イベントに参加していません', 'error');
      return;
    }
    
    // 完了済みマスの場合は確認モーダルを表示
    if (completedItems[index]) {
      setUndoIndex(index);
      setShowUndoModal(true);
      return;
    }
    
    // 写真系ミッションの場合はアップロードモーダルを表示
    if (bingoItems[index]?.type === 'photo') {
      setShowPhotoUpload(index);
      return;
    }
    
    // その他のミッションは直接完了に
    await performToggle(index);
  };
  
  const handlePhotoUpload = async (index: number, file: File) => {
    if (!user || !activeEventId) return;
    
    setUploadingPhoto(true);
    try {
      // ファイルをBase64に変換
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        
        // 画像をバックエンドに保存
        const uploadResponse = await fetch(buildApiUrl(`/events/${activeEventId}/participants/${user.uid}/bingo/${index}/photo`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData }),
        });
        
        if (uploadResponse.ok) {
          // ミッションを完了に
          await performToggle(index);
          setShowPhotoUpload(-1);
        } else {
          throw new Error('画像のアップロードに失敗しました');
        }
      };
      
      reader.onerror = () => {
        throw new Error('ファイルの読み込みに失敗しました');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast('写真のアップロードに失敗しました', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  const performToggle = async (index: number) => {
    if (!user || !activeEventId) return;
    
    try {
      const response = await fetch(buildApiUrl(`/events/${activeEventId}/participants/${user.uid}/bingo/${index}`), {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCompletedItems(data.bingoCompleted);
        setHasBingo(data.hasBingo);
        await refresh();

        if (data.hasBingo && data.bingoCompleted[index]) {
          showToast('🎉 ビンゴ達成！おめでとうございます！', 'success');
        }
      }
    } catch (error) {
      console.error('Error toggling bingo square:', error);
    }
  };
  
  const handleUndoConfirm = async () => {
    await performToggle(undoIndex);
    setShowUndoModal(false);
    setUndoIndex(-1);
  };

  const resetBingo = () => {
    setCompletedItems(new Array(9).fill(false));
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
          <h1 className="text-2xl font-bold text-blue-600 text-center">交流ビンゴ</h1>
        </div>
      </header>
      
      <main className="p-4 space-y-4">
        {hasBingo && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-yellow-800">
                <Trophy size={24} />
                <span className="font-semibold">
                  🎉 ビンゴ達成！
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-center">ビンゴカード</CardTitle>
          </CardHeader>
          <CardContent>
            {!bingoReady ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⏳</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">ミッション準備中</h3>
                <p className="text-gray-500 text-sm">
                  管理者があなた専用のビンゴミッションを生成中です。<br/>
                  しばらくお待ちください。
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {bingoItems.map((item, index) => {
                    const missionTypeIcon = {
                      talk: '💬',
                      photo: '📷',
                      find: '🔍',
                      experience: '✨'
                    }[item.type] || '💬';
                    
                    return (
                      <div
                        key={index}
                        onClick={() => toggleItem(index)}
                        className={`aspect-square border-2 rounded-lg flex flex-col items-center justify-center p-2 text-xs text-center cursor-pointer transition-colors ${
                          completedItems[index]
                            ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                            : 'bg-white border-gray-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="text-lg mb-1">{missionTypeIcon}</div>
                        <div className="leading-tight">{item.text}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {bingoReady && (
              <div className="space-y-2">
                <div className="text-center text-sm text-gray-600">
                  該当する人と話したらタップ。間違えたら再度タップで取り消し
                </div>
                
                <div className="text-center text-sm">
                  達成: {completedItems.filter(Boolean).length}/9
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <TabNavigation />
      
      {showUndoModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in-0 zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">マスを取り消しますか？</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              「{bingoItems[undoIndex]?.text}」を未完了に戻します。
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={handleUndoConfirm}
                variant="destructive"
                className="flex-1 rounded-xl"
              >
                取り消し
              </Button>
              <Button 
                onClick={() => setShowUndoModal(false)}
                variant="outline"
                className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50"
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {showPhotoUpload >= 0 && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in-0 zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">📷 写真をアップロード</h3>
            <p className="text-gray-600 mb-4 leading-relaxed">
              「{bingoItems[showPhotoUpload]?.text}」の写真をアップロードしてください。
            </p>
            <div className="mb-4">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handlePhotoUpload(showPhotoUpload, file);
                  }
                }}
                className="w-full p-2 border rounded-lg"
                disabled={uploadingPhoto}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => setShowPhotoUpload(-1)}
                variant="outline"
                className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50"
                disabled={uploadingPhoto}
              >
                キャンセル
              </Button>
            </div>
            {uploadingPhoto && (
              <div className="mt-3 text-center text-sm text-blue-600">
                アップロード中...
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
