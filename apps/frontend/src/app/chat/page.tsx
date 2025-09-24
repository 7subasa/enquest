'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { buildApiUrl } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      setUserId(user.uid);
      loadChatHistory(user.uid);
    }
  }, [user, loading, router]);

  // AIが自動で最初のメッセージを送信
  useEffect(() => {
    if (userId && messages.length === 0 && !isInitialized && !isLoading) {
      setIsInitialized(true);
      sendInitialMessage();
    }
  }, [userId, messages.length, isInitialized, isLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async (uid: string) => {
    try {
      const response = await fetch(buildApiUrl(`/ai/chat-history/${uid}`));
      if (response.ok) {
        const data = await response.json();
        setMessages(data.history || []);
      }
    } catch (error) {
      console.error('チャット履歴の読み込みに失敗:', error);
    }
  };

  const sendInitialMessage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: '初回挨拶'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          message: data.response,
          timestamp: new Date().toISOString()
        };
        setMessages([aiMessage]);
      }
    } catch (error) {
      console.error('初期メッセージエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || inputMessage.trim();
    if (!messageToSend || !userId || isLoading) return;

    if (!messageText) setInputMessage('');
    setIsLoading(true);

    // ユーザーメッセージを即座に表示（手動入力の場合のみ）
    if (!messageText) {
      const tempUserMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        message: messageToSend,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMessage]);
    }

    try {
      const response = await fetch(buildApiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: messageToSend
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          message: data.response,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('AIからの応答に失敗しました');
      }
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        message: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    '会話のきっかけが欲しい',
    'ビンゴミッションの攻略法',
    '緊張をほぐしたい',
    '年上の人との話し方'
  ];

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-800"
          >
            ← 戻る
          </button>
          <h1 className="text-xl font-bold text-gray-800">AIアシスタント</h1>
          <div className="w-8"></div>
        </div>
      </div>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                AIアシスタントが起動中...🤖
              </h2>
              <p className="text-gray-600">
                あなたのプロフィールを分析しています
              </p>
            </div>
          </div>
        )}
        
        {messages.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-2">
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  disabled={isLoading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-800 shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.message}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 shadow-sm px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>考え中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="メッセージを入力..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition-colors"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
