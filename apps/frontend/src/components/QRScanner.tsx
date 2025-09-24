"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Camera } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const startCamera = async () => {
      try {
        // Check if running on HTTPS or localhost
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          setError('カメラアクセスにはHTTPS接続が必要です');
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        setStream(mediaStream);
        setHasPermission(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Camera error:', err);
          setError(`カメラにアクセスできません: ${err.message}`);
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  const handleManualInput = () => {
    const shortCode = prompt('シェアコードを入力してください (例: ABC123):');
    if (shortCode) {
      onScan(shortCode.trim().toUpperCase());
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-sm mx-4">
          <h3 className="text-lg font-semibold mb-2">カメラエラー</h3>
          <p className="text-gray-600 mb-4 text-sm">{error}</p>
          <div className="space-y-2">
            <Button onClick={handleManualInput} className="w-full">
              手動入力
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full">
              閉じる
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-sm mx-4 text-center">
          <Camera size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">カメラ準備中</h3>
          <p className="text-gray-600 mb-4">カメラへのアクセスを許可してください</p>
          <Button onClick={handleClose} variant="outline" className="w-full">
            キャンセル
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="relative h-full">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <Button
          onClick={handleClose}
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 bg-white"
        >
          <X size={20} />
        </Button>
        <div className="absolute bottom-4 left-4 right-4 text-white text-center">
          <p className="mb-2">QRコードをカメラに向けてください</p>
          <Button 
            onClick={handleManualInput}
            variant="outline"
            className="bg-white text-black"
          >
            手動入力
          </Button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-2 border-white rounded-lg opacity-50"></div>
        </div>
      </div>
    </div>
  );
}