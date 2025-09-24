"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import QRScanner from "@/components/QRScanner";
import useEventParticipant from "@/hooks/useEventParticipant";
import { buildApiUrl } from "@/lib/api";

export default function ScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const {
    activeEvent,
    error: eventError,
    refresh,
  } = useEventParticipant({
    userId: user?.uid,
    includeParticipant: false,
    autoJoinIfMissing: false,
    enabled: !!user,
  });

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

  const handleQRScan = async (scannedData: string) => {
    try {
      let event = activeEvent;
      if (!event) {
        event = await refresh();
      }

      if (!event) {
        showToast('アクティブなイベントが見つかりません', 'error');
        router.push('/');
        return;
      }

      const isShortCode = /^[A-Z0-9]{6}$/.test(scannedData);

      if (!isShortCode && scannedData === user?.uid) {
        showToast('自分のQRコードです', 'info');
        router.push('/');
        return;
      }

      const requestBody = {
        user1Id: user?.uid,
        eventId: event.id,
        ...(isShortCode ? { user2Code: scannedData } : { user2Id: scannedData })
      };

      const response = await fetch(buildApiUrl('/icebreak'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        sessionStorage.setItem('icebreakResult', JSON.stringify(result));
        router.push('/');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Icebreak API error:', errorData);
        showToast(`アイスブレイクの生成に失敗しました: ${errorData.error}`, 'error');
        router.push('/');
      }
    } catch (error) {
      console.error('Scan error:', error);
      showToast('エラーが発生しました', 'error');
      router.push('/');
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
    <QRScanner 
      onScan={handleQRScan}
      onClose={() => router.push('/')}
    />
  );
}
