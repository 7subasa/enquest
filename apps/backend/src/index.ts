import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { VertexAI } from '@google-cloud/vertexai';

// Firebase Admin SDKの初期化
let serviceAccount: any;
try {
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      console.log('Loaded Firebase credentials from SERVICE_ACCOUNT_KEY environment variable.');
    } catch (envError) {
      console.error('Failed to parse SERVICE_ACCOUNT_KEY environment variable as JSON.');
      throw envError;
    }
  } else {
    serviceAccount = require('../serviceAccountKey.json');
    console.log('Loaded Firebase credentials from local serviceAccountKey.json file.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  console.error('Please set SERVICE_ACCOUNT_KEY env var or ensure serviceAccountKey.json is present in the apps/backend directory and is a valid service account key.');
  process.exit(1);
}

// Vertex AIの初期化
const vertex_ai = new VertexAI({ 
  project: serviceAccount.project_id, 
  location: 'us-central1',
  googleAuthOptions: {
    credentials: serviceAccount
  }
});
const model = 'gemini-2.5-flash-lite';

// AIヘルパー関数
const generateAIBingoMissions = async (userProfile: any, surveyAnswers: any): Promise<BingoMission[]> => {
  console.log('=== AI Bingo Mission Generation ===');
  console.log('Input userProfile:', userProfile);
  console.log('Input surveyAnswers:', surveyAnswers);
  
  try {
    console.log('Initializing Vertex AI model...');
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    const prompt = `あなたは企業イベントのビンゴゲーム企画者です。参加者のプロフィールとアンケート回答を基に、その人に最適化されたビンゴミッション9個を生成してください。

参加者情報：
- 部署: ${userProfile.department}
- 年齢: ${userProfile.age || '不明'}
- 性別: ${userProfile.gender || '不明'}
- 趣味: ${userProfile.hobbies || '不明'}
- 出身地: ${userProfile.hometown || '不明'}
- 好きな食べ物: ${userProfile.favoriteFood || '不明'}

アンケート回答：
${Object.entries(surveyAnswers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}

要件：
- 9個のミッションを生成
- 参加者同士の交流を促進する内容
- プロフィール情報を活用した個人化
- 以下の形式でJSONオブジェクト配列として出力

ミッションの種類：
1. 会話系：「〜な人と話す」「〜について聞く」など
2. 写真系：「〜と一緒に写真を撮る」「〜の写真を撮る」など
3. 体験系：「〜を一緒にやる」「〜を教えてもらう」など

出力形式：
[{"text": "同じ部署の人と話す", "type": "talk"}, {"text": "趣味が同じ人とツーショット写真を撮る", "type": "photo"}, {"text": "出身地が同じ人を見つける", "type": "find"}]

type値：
- "talk": 会話・質問系
- "photo": 写真撮影系
- "find": 発見・探索系
- "experience": 体験・実践系`;

    console.log('Sending prompt to Vertex AI...');
    console.log('Prompt length:', prompt.length);
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    console.log('Received response from Vertex AI');
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('AI Response:', text);
    
    const jsonMatch = text.match(/\[.*\]/s);
    
    if (jsonMatch) {
      console.log('Found JSON in response:', jsonMatch[0]);
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed missions:', parsed);
      
      // 新しいオブジェクト形式をサポート
      const missions = parsed.slice(0, 9).map((mission: any) => {
        if (typeof mission === 'string') {
          // 文字列のみの場合
          return { text: mission, type: 'talk' };
        } else if (mission.text && mission.type) {
          // ミッションタイプがある場合
          return mission;
        } else {
          // デフォルト
          return { text: String(mission), type: 'talk' };
        }
      });
      
      console.log('Final missions (first 9):', missions);
      return missions;
    }
    
    console.log('No JSON found in AI response, using fallback');
    throw new Error('No valid JSON found in AI response');
  } catch (error) {
    console.error('=== AI bingo generation failed ===');
    console.error('Error details:', error);
    console.error('Using fallback missions');
    const fallbackMissions: BingoMission[] = [
      { text: "同じ部署の人と話す", type: "talk" },
      { text: "趣味が同じ人とツーショット写真を撮る", type: "photo" },
      { text: "出身地が同じ人を見つける", type: "find" },
      { text: "好きな食べ物が同じ人と話す", type: "talk" },
      { text: "同じ年代の人と写真を撮る", type: "photo" },
      { text: "ペットを飼っている人を探す", type: "find" },
      { text: "海外旅行好きな人と話す", type: "talk" },
      { text: "スポーツ好きな人と一緒にポーズをとる", type: "photo" },
      { text: "読書好きな人と本の話をする", type: "talk" }
    ];
    console.log('Fallback missions:', fallbackMissions);
    return fallbackMissions;
  }
};

// アイスブレイク トピック生成
const generateAIIcebreakTopic = async (userA: any, userB: any, eventData?: any): Promise<string> => {
  console.log('=== generateAIIcebreakTopic called ===');
  console.log('UserA:', userA?.name || 'Unknown');
  console.log('UserB:', userB?.name || 'Unknown');
  try {
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    // イベント質問と回答をフォーマット
    const formatEventAnswers = (answers: any, surveyQuestions: any[]) => {
      if (!answers || !surveyQuestions) return '';
      return surveyQuestions.map((q, i) => {
        const answerKey = `answer${i + 1}`;
        const answer = answers[answerKey] || '未回答';
        return `- ${q.question}: ${answer}`;
      }).join('\n');
    };

    const eventAnswersA = eventData ? formatEventAnswers(userA.eventAnswers, eventData.surveyQuestions) : '';
    const eventAnswersB = eventData ? formatEventAnswers(userB.eventAnswers, eventData.surveyQuestions) : '';

    const prompt = `${userA.name || 'あなた'}さんが${userB.name || '相手'}さんのことを知るための質問をコミュニケーションアドバイスとして提案してください。

${userB.name || '相手'}さんの参考情報（内部分析用）：
- 部署: ${userB.department}
- 年齢: ${userB.age || '不明'}
- 性別: ${userB.gender || '不明'}
- 趣味: ${userB.hobbies || '不明'}
- 出身地: ${userB.hometown || '不明'}
- 好きな食べ物: ${userB.favoriteFood || '不明'}
${eventAnswersB ? `\nイベント質問回答：\n${eventAnswersB}` : ''}

${userA.name || 'あなた'}さんの参考情報（内部分析用）：
- 部署: ${userA.department}
- 年齢: ${userA.age || '不明'}
- 性別: ${userA.gender || '不明'}
- 趣味: ${userA.hobbies || '不明'}
- 出身地: ${userA.hometown || '不明'}
- 好きな食べ物: ${userA.favoriteFood || '不明'}
${eventAnswersA ? `\nイベント質問回答：\n${eventAnswersA}` : ''}

要件：
- 上記の情報を分析し、${userB.name || '相手'}さんが話しやすそうな質問を提案
- ${userB.name || '相手'}さんの具体的な情報は絶対に含めない（会話で知るため）
- 「〜について聞いてみてください」形式のアドバイス
- 自然な会話の流れで聞ける質問
- 30文字以内の簡潔なアドバイス

例: "休日はどんなことをして過ごしているか聞いてみてください"
例: "最近ハマっていることがあるか聞いてみてください"`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim() || '休日の過ごし方について話してみませんか？';
  } catch (error) {
    console.error('AI icebreaker generation failed:', error);
    return '休日の過ごし方について話してみませんか？';
  }
};

// スキャンされた側用のアドバイス生成
const generateAIReverseQuestions = async (userA: any, userB: any, eventData?: any): Promise<string[]> => {
  console.log('=== generateAIReverseQuestions called ===');
  console.log('UserA (スキャンした人):', userA?.name || 'Unknown');
  console.log('UserB (スキャンされた人):', userB?.name || 'Unknown');
  try {
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 1536,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    // イベント質問と回答をフォーマット
    const formatEventAnswers = (answers: any, surveyQuestions: any[]) => {
      if (!answers || !surveyQuestions) return '';
      return surveyQuestions.map((q, i) => {
        const answerKey = `answer${i + 1}`;
        const answer = answers[answerKey] || '未回答';
        return `- ${q.question}: ${answer}`;
      }).join('\n');
    };

    const eventAnswersA = eventData ? formatEventAnswers(userA.eventAnswers, eventData.surveyQuestions) : '';
    const eventAnswersB = eventData ? formatEventAnswers(userB.eventAnswers, eventData.surveyQuestions) : '';

    const prompt = `${userB.name || 'あなた'}さんが、${userA.name || '相手'}さんとの会話で自分から話しかける際に役立つコミュニケーションアドバイスを5個提案してください。

${userA.name || '相手'}さんのプロフィール：
- 部署: ${userA.department}
- 年齢: ${userA.age || '不明'}
- 性別: ${userA.gender || '不明'}
- 趣味: ${userA.hobbies || '不明'}
- 出身地: ${userA.hometown || '不明'}
- 好きな食べ物: ${userA.favoriteFood || '不明'}
${eventAnswersA ? `\nイベント質問回答：\n${eventAnswersA}` : ''}

${userB.name || 'あなた'}さんのプロフィール：
- 部署: ${userB.department}
- 年齢: ${userB.age || '不明'}
- 性別: ${userB.gender || '不明'}
- 趣味: ${userB.hobbies || '不明'}
- 出身地: ${userB.hometown || '不明'}
- 好きな食べ物: ${userB.favoriteFood || '不明'}
${eventAnswersB ? `\nイベント質問回答：\n${eventAnswersB}` : ''}

要件：
- 両者のプロフィールを分析し、${userA.name || '相手'}さんが興味を持ちそうな${userB.name || 'あなた'}さん自身の話題を提案
- 共通点や関連性を見つけて自然な会話のきっかけを作る
- 相手の具体的な情報は絶対に含めない（会話で知るため）
- 「〜について話してみてください」「〜を紹介してみてください」形式のアドバイス
- ${userB.name || 'あなた'}さんが自分から積極的に話せる内容
- JSON形式で回答: ["...", "...", "...", "...", "..."]

例: ["自分の趣味について話してみてください", "休日の過ごし方を紹介してみてください", "最近のマイブームを教えてあげてください"]`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\[.*\]/s);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.slice(0, 5);
    }
    
    return [
      '自分の趣味について話してみてください',
      '休日の過ごし方を紹介してみてください',
      '最近のマイブームを教えてあげてください',
      '仕事で楽しいことを話してみてください',
      '好きな食べ物やお店を紹介してみてください'
    ];
  } catch (error) {
    console.error('AI reverse icebreaker questions generation failed:', error);
    return [
      '自分の趣味について話してみてください',
      '休日の過ごし方を紹介してみてください',
      '最近のマイブームを教えてあげてください',
      '仕事で楽しいことを話してみてください',
      '好きな食べ物やお店を紹介してみてください'
    ];
  }
};

// アイスブレイク 質問例生成（スキャンした側用）
const generateAIIcebreakQuestions = async (userA: any, userB: any, eventData?: any): Promise<string[]> => {
  console.log('=== generateAIIcebreakQuestions called ===');
  console.log('UserA (スキャンした人):', userA?.name || 'Unknown');
  console.log('UserB (スキャンされた人):', userB?.name || 'Unknown');
  try {
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 1536,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    // イベント質問と回答をフォーマット
    const formatEventAnswers = (answers: any, surveyQuestions: any[]) => {
      if (!answers || !surveyQuestions) return '';
      return surveyQuestions.map((q, i) => {
        const answerKey = `answer${i + 1}`;
        const answer = answers[answerKey] || '未回答';
        return `- ${q.question}: ${answer}`;
      }).join('\n');
    };

    const eventAnswersA = eventData ? formatEventAnswers(userA.eventAnswers, eventData.surveyQuestions) : '';
    const eventAnswersB = eventData ? formatEventAnswers(userB.eventAnswers, eventData.surveyQuestions) : '';

    const prompt = `${userA.name || 'あなた'}さんが${userB.name || '相手'}さんとの会話を深めるためのコミュニケーションアドバイスを5個提案してください。

${userB.name || '相手'}さんの参考情報（内部分析用）：
- 部署: ${userB.department}
- 年齢: ${userB.age || '不明'}
- 性別: ${userB.gender || '不明'}
- 趣味: ${userB.hobbies || '不明'}
- 出身地: ${userB.hometown || '不明'}
- 好きな食べ物: ${userB.favoriteFood || '不明'}
${eventAnswersB ? `\nイベント質問回答：\n${eventAnswersB}` : ''}

${userA.name || 'あなた'}さんの参考情報（内部分析用）：
- 部署: ${userA.department}
- 年齢: ${userA.age || '不明'}
- 性別: ${userA.gender || '不明'}
- 趣味: ${userA.hobbies || '不明'}
- 出身地: ${userA.hometown || '不明'}
- 好きな食べ物: ${userA.favoriteFood || '不明'}
${eventAnswersA ? `\nイベント質問回答：\n${eventAnswersA}` : ''}

要件：
- 上記の情報を分析し、${userB.name || '相手'}さんが興味を持ちそうな話題や質問を提案
- ${userB.name || '相手'}さんの具体的な情報は絶対に含めない（会話で知るため）
- 「〜について聞いてみてください」「〜はいかがですか？と聞いてみてください」形式のアドバイス
- 共通点や関連性を活かして自然な会話のきっかけを作る
- ${userB.name || '相手'}さんが話しやすそうな話題を優先
- JSON形式で回答: ["...", "...", "...", "...", "..."]

例: ["趣味や好きなことについて詳しく聞いてみてください", "休日の過ごし方について話してみてください", "最近興味を持っていることがあるか聞いてみてください"]`;

    console.log('=== generateAIIcebreakQuestions PROMPT ===');
    console.log('Prompt:', prompt);
    console.log('=== END PROMPT ===');

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\[.*\]/s);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.slice(0, 5);
    }
    
    return [
      '相手の仕事のやりがいや楽しさについて聞いてみてください',
      '休日の過ごし方やリフレッシュ方法を教えてもらってみてください',
      '最近のマイブームや新しい発見について話してみてください',
      'お互いの出身地や旅行経験について情報交換してみてください',
      '仕事で大切にしていることや目標について聞いてみてください'
    ];
  } catch (error) {
    console.error('AI icebreaker questions generation failed:', error);
    return [
      '相手の仕事のやりがいや楽しさについて聞いてみてください',
      '休日の過ごし方やリフレッシュ方法を教えてもらってみてください',
      '最近のマイブームや新しい発見について話してみてください',
      'お互いの出身地や旅行経験について情報交換してみてください',
      '仕事で大切にしていることや目標について聞いてみてください'
    ];
  }
};

// AIエージェント基底クラス
interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AgentContext {
  conversationHistory: AgentMessage[];
  userProfile: any;
  eventContext?: any;
  metadata?: Record<string, any>;
}

// Markdownエンコード関数
const encodeMarkdownResponse = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
};

// AIエージェントレスポンス処理
const processAgentResponse = (response: string, format: 'markdown' | 'plain' = 'markdown'): string => {
  if (format === 'markdown') {
    return encodeMarkdownResponse(response);
  }
  return response;
};ing, any>;
}

interface BingoMission {
  text: string;
  type: string;
}

class BaseAgent {
  private context: AgentContext;
  private agentConfig: {
    name: string;
    description: string;
    instructions: string;
    temperature: number;
    maxTokens: number;
  };

  constructor(agentConfig: any, userProfile: any, eventContext?: any) {
    this.agentConfig = {
      temperature: 0.8,
      maxTokens: 1536,
      ...agentConfig
    };
    
    this.context = {
      conversationHistory: [],
      userProfile,
      eventContext
    };
  }

  async generateResponse(userMessage: string): Promise<{ response: string; actions?: any[] }> {
    try {
      this.addMessageToHistory('user', userMessage);
      
      const prompt = this.buildPrompt(userMessage);
      
      const generativeModel = vertex_ai.preview.getGenerativeModel({
        model: model,
        generationConfig: {
          maxOutputTokens: this.agentConfig.maxTokens,
          temperature: this.agentConfig.temperature,
          topP: 0.9,
        },
      });

      const result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      this.addMessageToHistory('assistant', responseText);
      
      return { response: responseText.trim() || this.getFallbackResponse() };
    } catch (error) {
      console.error(`Agent ${this.agentConfig.name} error:`, error);
      return { response: this.getFallbackResponse() };
    }
  }

  private buildPrompt(userMessage: string): string {
    const systemPrompt = `
あなたは${this.agentConfig.name}です。
役割: ${this.agentConfig.description}

指示事項:
${this.agentConfig.instructions}

ユーザープロフィール:
${this.formatUserProfile()}

${this.context.eventContext ? `現在のイベント: ${this.context.eventContext.eventName}` : ''}

過去の会話履歴:
${this.getFormattedHistory()}

現在のユーザーメッセージ: ${userMessage}

上記の役割と指示事項に従って、ユーザーのプロフィールを活用し、適切に応答してください。
    `.trim();
    
    return systemPrompt;
  }

  private formatUserProfile(): string {
    const profile = this.context.userProfile;
    return `
- 名前: ${profile.name || '不明'}
- 部署: ${profile.department || '不明'}
- 年齢: ${profile.age || '不明'}
- 趣味: ${profile.hobbies || '不明'}
- 出身地: ${profile.hometown || '不明'}
- 好きな食べ物: ${profile.favoriteFood || '不明'}`;
  }

  private addMessageToHistory(role: 'user' | 'assistant' | 'system', content: string): void {
    this.context.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
    
    if (this.context.conversationHistory.length > 20) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-20);
    }
  }

  private getFormattedHistory(): string {
    return this.context.conversationHistory
      .slice(-5)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private getFallbackResponse(): string {
    const profile = this.context.userProfile;
    return `お疲れ様です！${profile.name || 'あなた'}さん、今日のイベントはいかがですか？何でもお気軽にご相談ください😊`;
  }

  loadHistory(chatHistory: any[]): void {
    this.context.conversationHistory = chatHistory.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.message,
      timestamp: new Date(h.timestamp || Date.now())
    }));
  }
}

// コミュニケーション支援エージェント
class CommunicationAgent extends BaseAgent {
  constructor(userProfile: any, eventContext?: any) {
    const config = {
      name: 'コミュニケーション支援AI',
      description: '企業イベントでの積極的なコミュニケーション支援AIエージェント',
      instructions: `
## 主要な役割
1. ユーザーの感情や状況を的確に分析
2. プロフィール情報を活用した個別最適化アドバイス
3. 具体的で実行可能なアクションプランの提示
4. 自然な会話継続のための質問投げかけ

## 対応パターン
### 初回接触時
- プロフィール分析に基づく個別化された挨拶
- その人の強みを活かした交流戦略の提案
- 具体的な会話スターター例の提示

### 悩み相談時
- 共感的理解の表現
- 段階的解決策の提示
- 実践的な会話例やフレーズの提供
- 成功体験への誘導

### 成功報告時
- 具体的な称賛と成果の確認
- さらなるチャレンジの提案
- 学びの振り返りと次回への活用

### 会話継続支援
- 相手の興味を引く話題の提案
- 共通点発見のためのヒント
- 自然な会話の流れ作り

## 回答スタイル
- 300文字以内で簡潔に
- 絵文字を適度に使用して親しみやすく
- 具体的なアクション項目を含める
- 次の行動への明確な誘導
- ユーザーの部署や趣味を活かした提案`
    };
    
    super(config, userProfile, eventContext);
  }
}

// AIチャット応答生成（リファクタリング版）
const generateAIChatResponse = async (userMessage: string, userProfile: any, chatHistory: any[] = [], eventContext?: any): Promise<{ response: string; actions?: any[] }> => {
  try {
    const agent = new CommunicationAgent(userProfile, eventContext);
    
    // 履歴をロード
    if (chatHistory.length > 0) {
      agent.loadHistory(chatHistory);
    }
    
    return await agent.generateResponse(userMessage);
  } catch (error) {
    console.error('AI chat response generation failed:', error);
    return { 
      response: `お疲れ様です！${userProfile.name || 'あなた'}さん、今日のイベントはいかがですか？何でもお気軽にご相談ください😊`
    };
  }
};

// AIアンケート質問生成
const generateAISurveyQuestions = async (eventName: string, count: number = 3, eventType?: string): Promise<string[]> => {
  console.log('=== AI Survey Questions Debug ===');
  console.log('Event Name:', eventName);
  console.log('Question Count:', count);
  console.log('Event Type:', eventType);
  
  try {
    console.log('Initializing Vertex AI model...');
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 1,
        topP: 0.95,
      },
    });
    console.log('Model initialized successfully');

    const prompt = `あなたは企業イベントの企画担当者です。
「${eventName}」というイベント前に参加者同士のコミュニケーションを促進するためのアンケート質問を${count}個提案してください。

このアンケートの目的：
- イベント前に参加者の興味や趣味を把握する
- 参加者同士の共通点を見つけやすくする
- 当日のコミュニケーションのきっかけを作る

制約：
- 質問は${count}個必ず生成してください
- 各質問は簡潔で答えやすいものにしてください
- 参加者が楽しく答えられる内容にしてください
- 回答はJSON形式の配列で、各要素が質問の文字列になるようにしてください

例：["好きな食べ物", "最近ハマっていること", "休日の過ごし方"]`;
    
    console.log('Sending request to Vertex AI...');
    console.log('Prompt length:', prompt.length);
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    console.log('Received response from Vertex AI');
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('AI Response:', text);
    
    // レスポンスからJSONを抽出
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      console.log('Found JSON in response:', jsonMatch[0]);
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed questions:', parsed);
      return parsed;
    }
    
    console.log('No JSON found in response, using fallback');
    const fallbackQuestions = [
      '好きな食べ物',
      '最近ハマっていること',
      '休日の過ごし方',
      '好きな音楽ジャンル',
      '行ってみたい旅行先',
      '学生時代の部活動',
      '最近読んだ本',
      'ストレス発散方法',
      '好きなスポーツ',
      '今年挑戦したいこと'
    ];
    return fallbackQuestions.slice(0, count);
  } catch (error) {
    console.error('=== ERROR in generateAISurveyQuestions ===');
    console.error('Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const fallbackQuestions = [
      '好きな食べ物',
      '最近ハマっていること', 
      '休日の過ごし方',
      '好きな音楽ジャンル',
      '行ってみたい旅行先',
      '学生時代の部活動',
      '最近読んだ本',
      'ストレス発散方法',
      '好きなスポーツ',
      '今年挑戦したいこと'
    ];
    return fallbackQuestions.slice(0, count);
  }
};

const app = express();
const port = parseInt(process.env.PORT || '8000', 10);

// CORSミドルウェア
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// JSONボディを解析するミドルウェア
app.use(express.json());

// リクエストログミドルウェア（一時的に無効化）
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
//   if (req.body && Object.keys(req.body).length > 0) {
//     console.log('Request body:', req.body);
//   }
//   next();
// });

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World');
});

// デバッグテストエンドポイント
app.get('/api/debug/test', (req: Request, res: Response) => {
  console.log('Debug test endpoint called');
  res.json({ 
    message: 'Server is working',
    timestamp: new Date().toISOString(),
    project: serviceAccount.project_id
  });
});

// Vertex AI接続テスト
app.get('/api/debug/vertex-ai', async (req: Request, res: Response) => {
  try {
    console.log('Testing Vertex AI connection...');
    console.log('Project ID:', serviceAccount.project_id);
    console.log('Service account email:', serviceAccount.client_email);
    
    const testModel = vertex_ai.preview.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const result = await testModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello, respond with just "OK"' }] }],
    });
    
    console.log('Vertex AI test successful');
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ success: true, response: text });
  } catch (error: any) {
    console.error('Vertex AI test failed:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// AIチャット
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { userId, message, eventId } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }

    // ユーザー情報を取得
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userProfile = userDoc.data();

    // チャット履歴を取得（最新5件）
    const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory')
      .orderBy('timestamp', 'desc').limit(5);
    const chatHistorySnapshot = await chatHistoryRef.get();
    const chatHistory = chatHistorySnapshot.docs.map(doc => doc.data()).reverse();

    // イベント情報を取得
    let eventContext = null;
    if (eventId) {
      const eventDoc = await db.collection('events').doc(eventId).get();
      if (eventDoc.exists) {
        eventContext = eventDoc.data();
      }
    }

    // 参加者情報を取得（イベント参加者データ）
    let participantData = null;
    if (eventId) {
      const participantDoc = await db.collection('events').doc(eventId)
        .collection('event_participants').doc(userId).get();
      if (participantDoc.exists) {
        participantData = participantDoc.data();
      }
    }

    // 拡張ユーザープロフィール（参加者データを含む）
    const enhancedProfile = {
      ...userProfile,
      surveyAnswers: participantData?.answers || {},
      bingoProgress: participantData?.bingoCompleted || [],
      bingoBoard: participantData?.bingoBoard || []
    };

    // AI応答を生成
    const aiResult = await generateAIChatResponse(message, enhancedProfile, chatHistory, eventContext);
    const aiResponse = typeof aiResult === 'string' ? aiResult : aiResult.response;

    // チャット履歴を保存
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const chatRef = db.collection('users').doc(userId).collection('chatHistory');
    
    await chatRef.add({
      role: 'user',
      message: message,
      timestamp: timestamp
    });
    
    await chatRef.add({
      role: 'assistant', 
      message: aiResponse,
      timestamp: timestamp
    });

    res.json({ 
      response: aiResponse,
      actions: typeof aiResult === 'object' ? aiResult.actions : undefined
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// チャット履歴取得
app.get('/api/ai/chat-history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();
    
    const chatHistoryRef = db.collection('users').doc(userId).collection('chatHistory')
      .orderBy('timestamp', 'asc').limit(20);
    const snapshot = await chatHistoryRef.get();
    
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null
    }));
    
    res.json({ history });
  } catch (error: any) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ショートコードの生成
const generateShortCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 新規ユーザー作成エンドポイント
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { email, password, name, department, role = 'participant' } = req.body;

    if (!email || !password || !name || !department) {
      return res.status(400).send('Email, password, name, and department are required');
    }

    // Firebase Authenticationでユーザーを作成
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    // ユニークなショートコードを生成
    const shortCode = generateShortCode();

    // Firestoreにユーザードキュメントを作成
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      name,
      email: userRecord.email,
      department,
      role,
      shortCode,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ 
      userId: userRecord.uid,
      shortCode,
      message: 'User created successfully' 
    });

  } catch (error: any) {
    console.error('Error creating new user:', error);
    res.status(500).json({ error: error.message });
  }
});

// 新規イベント作成エンドポイント
app.post('/api/events', async (req: Request, res: Response) => {
  try {
    const { eventName } = req.body;

    if (!eventName) {
      return res.status(400).send('Event name is required');
    }

    const db = admin.firestore();
    const eventRef = await db.collection('events').add({
      eventName,
      isActive: true,
      surveyQuestions: [
        { id: 1, question: "最近よく聴く曲" },
        { id: 2, question: "最近ハマっていること" }
      ],
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ 
      eventId: eventRef.id, 
      message: 'Event created successfully' 
    });

  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// 全イベント取得エンドポイント
app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const eventsSnapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
    
    const eventsWithParticipantCount = await Promise.all(
      eventsSnapshot.docs.map(async (doc) => {
        // 各イベントの参加者数を取得
        const participantsSnapshot = await db.collection('events').doc(doc.id)
          .collection('event_participants').get();
        
        return {
          id: doc.id,
          ...doc.data(),
          participantCount: participantsSnapshot.size
        };
      })
    );

    res.json(eventsWithParticipantCount);

  } catch (error: any) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: error.message });
  }
});

// アクティブイベント取得エンドポイント
app.get('/api/events/active', async (req: Request, res: Response) => {
  console.log('=== Active Event API Called ===');
  try {
    const db = admin.firestore();
    const eventsSnapshot = await db.collection('events').where('isActive', '==', true).get();
    
    console.log('Active events found:', eventsSnapshot.size);
    
    if (eventsSnapshot.empty) {
      console.log('No active events found');
      return res.status(404).json({ message: 'No active event found' });
    }

    const activeEvent = eventsSnapshot.docs[0];
    const eventData = {
      id: activeEvent.id, 
      ...activeEvent.data() 
    };
    
    console.log('Returning active event:', eventData);
    res.json(eventData);

  } catch (error: any) {
    console.error('Error getting active event:', error);
    res.status(500).json({ error: error.message });
  }
});

// イベント更新エンドポイント
app.put('/api/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { isActive, eventName } = req.body;
    
    const db = admin.firestore();
    const updateData: any = {};
    
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (eventName) updateData.eventName = eventName;
    if (req.body.surveyQuestions) updateData.surveyQuestions = req.body.surveyQuestions;
    
    await db.collection('events').doc(eventId).update(updateData);
    
    res.json({ message: 'Event updated successfully' });

  } catch (error: any) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// イベント参加者取得エンドポイント
app.get('/api/events/:eventId/participants', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    const participantsSnapshot = await db.collection('events').doc(eventId)
      .collection('event_participants').get();
    
    const participants = await Promise.all(
      participantsSnapshot.docs.map(async (doc) => {
        const participantData = doc.data();
        
        // 実際のユーザー情報を取得
        const userDoc = await db.collection('users').doc(doc.id).get();
        const userData = userDoc.data();
        
        return {
          id: doc.id,
          ...participantData,
          userName: userData?.name || participantData.userName
        };
      })
    );

    res.json(participants);

  } catch (error: any) {
    console.error('Error getting event participants:', error);
    res.status(500).json({ error: error.message });
  }
});

// イベントに参加者を追加するエンドポイント
app.post('/api/events/:eventId/participants', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).send('User ID is required');
    }

    const db = admin.firestore();
    
    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }
    
    const userData = userDoc.data();
    
    // イベント参加者に追加
    await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).set({
        userId,
        userName: userData?.name,
        answers: {},
        bingoBoard: userData?.role === 'admin' ? ([
          { text: "同じ部署の人と話す", type: "talk" },
          { text: "趣味が同じ人とツーショット写真を撮る", type: "photo" },
          { text: "出身地が同じ人を見つける", type: "find" },
          { text: "好きな食べ物が同じ人と話す", type: "talk" },
          { text: "同じ年代の人と写真を撮る", type: "photo" },
          { text: "ペットを飼っている人を探す", type: "find" },
          { text: "海外旅行好きな人と話す", type: "talk" },
          { text: "スポーツ好きな人と一緒にポーズをとる", type: "photo" },
          { text: "読書好きな人と本の話をする", type: "talk" }
        ] as BingoMission[]) : ([] as BingoMission[]),
        bingoCompleted: new Array(9).fill(false),
        bingoReady: userData?.role === 'admin' ? true : false, // 管理者は即座にビンゴ開始可能
        createdAt: new Date().toISOString()
      });

    res.json({ message: 'Participant added successfully' });

  } catch (error: any) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: error.message });
  }
});

// イベント削除エンドポイント
app.delete('/api/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    // 最初に全参加者を削除
    const participantsSnapshot = await db.collection('events').doc(eventId)
      .collection('event_participants').get();
    
    const batch = db.batch();
    participantsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // イベントを削除
    batch.delete(db.collection('events').doc(eventId));
    
    await batch.commit();
    
    res.json({ message: 'Event deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
});

// イベントから参加者を削除するエンドポイント
app.delete('/api/events/:eventId/participants/:userId', async (req: Request, res: Response) => {
  try {
    const { eventId, userId } = req.params;
    const db = admin.firestore();
    
    await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).delete();
    
    res.json({ message: 'Participant removed successfully' });

  } catch (error: any) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: error.message });
  }
});

// 全ユーザー取得エンドポイント
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);

  } catch (error: any) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: error.message });
  }
});

// ユーザー情報取得エンドポイント
app.get('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userData = userDoc.data();
    
    // ショートコードが存在しない場合は生成
    if (!userData?.shortCode) {
      const shortCode = generateShortCode();
      await db.collection('users').doc(userId).update({ shortCode });
      userData = { ...userData, shortCode };
    }

    res.json({ 
      id: userDoc.id, 
      ...userData 
    });

  } catch (error: any) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ショートコードでユーザー取得エンドポイント
app.get('/api/users/shortcode/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').where('shortCode', '==', code.toUpperCase()).get();
    
    if (usersSnapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userDoc = usersSnapshot.docs[0];
    res.json({ 
      id: userDoc.id, 
      ...userDoc.data() 
    });

  } catch (error: any) {
    console.error('Error getting user by short code:', error);
    res.status(500).json({ error: error.message });
  }
});

// 参加者の回答保存エンドポイント
app.post('/api/events/:eventId/participants/me/answers', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { userId, answers } = req.body;

    if (!userId || !answers || !Array.isArray(answers)) {
      return res.status(400).send('User ID and answers array are required');
    }

    const db = admin.firestore();
    
    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }
    
    const userData = userDoc.data();
    
    // 回答配列をオブジェクトに変換
    const answersObj: any = {};
    answers.forEach((answer: any, index: number) => {
      answersObj[`answer${index + 1}`] = answer.answer;
    });

    // 参加者の回答を更新
    await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).update({
        answers: answersObj
      });

    // 回答保存時はビンゴ準備完了フラグを設定（管理者が生成するまで待機）
    await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).update({
        bingoReady: false
      });

    res.json({ message: 'Answers saved successfully' });

  } catch (error: any) {
    console.error('Error saving answers:', error);
    res.status(500).json({ error: error.message });
  }
});

// AIアイスブレイクエンドポイント
app.post('/api/icebreak', async (req: Request, res: Response) => {
  console.log('=== Icebreak API Called ===');
  console.log('Request body:', req.body);
  
  try {
    const { user1Id, user2Id, user2Code, eventId } = req.body;

    if (!user1Id || (!user2Id && !user2Code) || !eventId) {
      console.log('Missing required parameters:', { user1Id, user2Id, user2Code, eventId });
      return res.status(400).json({ error: 'User1 ID, event ID, and either User2 ID or short code are required' });
    }

    const db = admin.firestore();
    let sessionId: string | undefined;
    
    // イベントが存在するか確認
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      console.log('Event not found:', eventId);
      return res.status(404).json({ error: 'Event not found' });
    }
    
    let user2DocId;
    if (user2Code) {
      console.log('Searching for user with short code:', user2Code);
      const user2Snapshot = await db.collection('users').where('shortCode', '==', user2Code.toUpperCase()).get();
      if (user2Snapshot.empty) {
        console.log('User not found with short code:', user2Code);
        return res.status(404).json({ error: 'User with short code not found' });
      }
      user2DocId = user2Snapshot.docs[0].id;
      console.log('Found user2DocId:', user2DocId);
    } else {
      user2DocId = user2Id;
      console.log('Using provided user2Id:', user2DocId);
    }

    // 回答付きの参加者データを取得
    const [user1ParticipantDoc, user2ParticipantDoc] = await Promise.all([
      db.collection('events').doc(eventId).collection('event_participants').doc(user1Id).get(),
      db.collection('events').doc(eventId).collection('event_participants').doc(user2DocId).get()
    ]);

    let user1Data: any;
    let user2Data: any;

    // 参加者が見つからない場合は自動追加
    if (!user1ParticipantDoc.exists || !user2ParticipantDoc.exists) {
      console.log('Adding missing participants to event');
      
      const [user1Doc, user2Doc] = await Promise.all([
        db.collection('users').doc(user1Id).get(),
        db.collection('users').doc(user2DocId).get()
      ]);
      
      if (!user1Doc.exists || !user2Doc.exists) {
        return res.status(404).json({ error: 'One or both users not found' });
      }
      
      const batch = db.batch();
      
      if (!user1ParticipantDoc.exists) {
        const tempUser1Data = user1Doc.data();
        batch.set(db.collection('events').doc(eventId).collection('event_participants').doc(user1Id), {
          userId: user1Id,
          userName: tempUser1Data?.name,
          answers: {},
          bingoBoard: [],
          bingoCompleted: new Array(9).fill(false),
          bingoReady: false,
          createdAt: new Date().toISOString()
        });
        // ユーザーデータを更新
        user1Data = {
          userId: user1Id,
          userName: tempUser1Data?.name,
          answers: {},
          bingoBoard: [],
          bingoCompleted: new Array(9).fill(false),
          bingoReady: false
        };
      }
      
      if (!user2ParticipantDoc.exists) {
        const tempUser2Data = user2Doc.data();
        batch.set(db.collection('events').doc(eventId).collection('event_participants').doc(user2DocId), {
          userId: user2DocId,
          userName: tempUser2Data?.name,
          answers: {},
          bingoBoard: [],
          bingoCompleted: new Array(9).fill(false),
          bingoReady: false,
          createdAt: new Date().toISOString()
        });
        // ユーザーデータを更新
        user2Data = {
          userId: user2DocId,
          userName: tempUser2Data?.name,
          answers: {},
          bingoBoard: [],
          bingoCompleted: new Array(9).fill(false),
          bingoReady: false
        };
      }
      
      await batch.commit();
    } else {
      user1Data = user1ParticipantDoc.data();
      user2Data = user2ParticipantDoc.data();
    }

    // ユーザー情報を取得
    const [user1ProfileDoc, user2ProfileDoc] = await Promise.all([
      db.collection('users').doc(user1Id).get(),
      db.collection('users').doc(user2DocId).get()
    ]);

    const user1Profile = user1ProfileDoc.data();
    const user2Profile = user2ProfileDoc.data();

    // アイスブレイクセッションを作成
    sessionId = `${eventId}_${user1Id}_${user2DocId}_${Date.now()}`;
    const sessionRef = db.collection('icebreakSessions').doc(sessionId);
    
    // セッション作成（生成中状態）
    await sessionRef.set({
      user1Id,
      user2Id: user2DocId,
      eventId,
      status: 'generating',
      createdAt: new Date().toISOString(),
      user1Name: user1Profile?.name || user1Data?.userName,
      user2Name: user2Profile?.name || user2Data?.userName
    });
    
    // イベントデータを取得
    const eventData = eventDoc.data();
    
    console.log('=== Generating AI responses ===');
    console.log('User1 (scanner):', user1Profile?.name);
    console.log('User2 (scanned):', user2Profile?.name);
    
    // AIアイスブレイクトピックと質問を生成
    console.log('Generating topic and questions for scanner (user1)');
    const [topic, questions] = await Promise.all([
      generateAIIcebreakTopic(
        {
          ...user1Profile,
          eventAnswers: user1Data?.answers
        },
        {
          ...user2Profile,
          eventAnswers: user2Data?.answers
        },
        eventData
      ),
      generateAIIcebreakQuestions(
        {
          ...user1Profile,
          eventAnswers: user1Data?.answers
        },
        {
          ...user2Profile,
          eventAnswers: user2Data?.answers
        },
        eventData
      )
    ]);
    
    console.log('Generating advice and questions for scanned user (user2)');
    // スキャンされた側用のアドバイスも生成
    const [reverseAdvice, reverseQuestions] = await Promise.all([
      generateAIIcebreakTopic(
        {
          ...user2Profile,
          eventAnswers: user2Data?.answers
        },
        {
          ...user1Profile,
          eventAnswers: user1Data?.answers
        },
        eventData
      ),
      generateAIReverseQuestions(
        {
          ...user1Profile,
          eventAnswers: user1Data?.answers
        },
        {
          ...user2Profile,
          eventAnswers: user2Data?.answers
        },
        eventData
      )
    ]);
    
    console.log('=== AI generation completed ===');
    console.log('Topic for scanner (user1/initiator):', topic);
    console.log('Questions for scanner (user1/initiator):', questions);
    console.log('Reverse advice for scanned (user2/responder):', reverseAdvice);
    console.log('Reverse questions for scanned (user2/responder):', reverseQuestions);
    
    console.log('=== Final response structure ===');
    console.log('user1Id (scanner):', user1Id);
    console.log('user2Id (scanned):', user2DocId);
    console.log('user1Name:', user1Profile?.name);
    console.log('user2Name:', user2Profile?.name);

    // セッション完了状態に更新
    await sessionRef.update({
      status: 'completed',
      icebreakData: {
        topic,
        questions,
        reverseAdvice,
        reverseQuestions,
        user1Role: 'initiator',
        user2Role: 'responder',
        // 役割別データ構造
        initiatorData: {
          topic: topic,
          questions: questions
        },
        responderData: {
          topic: reverseAdvice,
          questions: reverseQuestions
        }
      },
      completedAt: new Date().toISOString()
    });

    const responseData = {
      sessionId,
      topic,
      questions,
      reverseAdvice,
      reverseQuestions,
      users: {
        user1: { name: user1Profile?.name || user1Data?.userName },
        user2: { name: user2Profile?.name || user2Data?.userName }
      },
      // 役割別データ構造
      initiatorData: {
        topic: topic,
        questions: questions
      },
      responderData: {
        topic: reverseAdvice,
        questions: reverseQuestions
      },
      // デバッグ情報
      debug: {
        user1Id: user1Id,
        user2Id: user2DocId,
        user1Name: user1Profile?.name,
        user2Name: user2Profile?.name,
        user1Role: 'initiator',
        user2Role: 'responder'
      }
    };
    
    console.log('=== Sending response ===');
    console.log('Response data:', JSON.stringify(responseData, null, 2));
    
    res.json(responseData);

  } catch (error: any) {
    console.error('=== Error generating icebreak ===');
    console.error('Error details:', error);
    
    res.status(500).json({ error: error.message });
  }
});

// ビンゴマス切り替えエンドポイント（完了/未完了）
app.post('/api/events/:eventId/participants/:userId/bingo/:index', async (req: Request, res: Response) => {
  try {
    const { eventId, userId, index } = req.params;
    const bingoIndex = parseInt(index);
    
    if (bingoIndex < 0 || bingoIndex > 8) {
      return res.status(400).send('Invalid bingo index');
    }

    const db = admin.firestore();
    const participantRef = db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId);
    
    const participantDoc = await participantRef.get();
    if (!participantDoc.exists) {
      return res.status(404).send('Participant not found');
    }

    const participantData = participantDoc.data();
    const bingoCompleted = participantData?.bingoCompleted || new Array(9).fill(false);
    
    // マス状態を切り替え
    bingoCompleted[bingoIndex] = !bingoCompleted[bingoIndex];
    
    // ビンゴライン判定
    const checkBingo = (completed: boolean[]) => {
      const lines = [
        [0,1,2], [3,4,5], [6,7,8], // 横
        [0,3,6], [1,4,7], [2,5,8], // 縦
        [0,4,8], [2,4,6] // 斜め
      ];
      return lines.some(line => line.every(i => completed[i]));
    };
    
    const hasBingo = checkBingo(bingoCompleted);
    
    const updateData: any = {
      bingoCompleted,
      hasBingo
    };
    
    // ビンゴ達成時刻の管理
    if (hasBingo && !participantData?.hasBingo) {
      updateData.bingoAchievedAt = new Date().toISOString();
    } else if (!hasBingo && participantData?.hasBingo) {
      updateData.bingoAchievedAt = admin.firestore.FieldValue.delete();
    }
    
    await participantRef.update(updateData);

    res.json({ 
      success: true, 
      hasBingo,
      bingoCompleted,
      message: bingoCompleted[bingoIndex] 
        ? (hasBingo ? 'ビンゴ達成！' : 'マスを完了しました')
        : 'マスを取り消しました'
    });

  } catch (error: any) {
    console.error('Error toggling bingo square:', error);
    res.status(500).json({ error: error.message });
  }
});

// 参加者のビンゴ状態取得エンドポイント
app.get('/api/events/:eventId/participants/:userId/bingo', async (req: Request, res: Response) => {
  try {
    const { eventId, userId } = req.params;
    const db = admin.firestore();
    
    const participantDoc = await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).get();
    
    if (!participantDoc.exists) {
      return res.status(404).send('Participant not found');
    }

    const data = participantDoc.data();
    res.json({
      bingoBoard: data?.bingoBoard || [],
      bingoCompleted: data?.bingoCompleted || new Array(9).fill(false),
      hasBingo: data?.hasBingo || false,
      bingoReady: data?.bingoReady || false,
      bingoAchievedAt: data?.bingoAchievedAt
    });

  } catch (error: any) {
    console.error('Error getting bingo state:', error);
    res.status(500).json({ error: error.message });
  }
});

// プロフィール更新エンドポイント
app.put('/api/users/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { name, department, email, age, gender, favoriteFood, hobbies, hometown, musicGenre, currentInterest, message } = req.body;
    
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }
    
    const profileData: any = {};
    
    // 基本情報の更新
    if (name !== undefined) profileData.name = name;
    if (department !== undefined) profileData.department = department;
    if (email !== undefined) {
      profileData.email = email;
      // Firebase Authenticationのメールアドレスも更新
      try {
        await admin.auth().updateUser(userId, { email });
      } catch (authError) {
        console.error('Error updating Firebase Auth email:', authError);
        // Firestoreは更新するが、Auth更新失敗は警告として扱う
      }
    }
    
    // 詳細プロフィールの更新
    if (age !== undefined) profileData.age = age;
    if (gender !== undefined) profileData.gender = gender;
    if (favoriteFood !== undefined) profileData.favoriteFood = favoriteFood;
    if (hobbies !== undefined) profileData.hobbies = hobbies;
    if (hometown !== undefined) profileData.hometown = hometown;
    if (musicGenre !== undefined) profileData.musicGenre = musicGenre;
    if (currentInterest !== undefined) profileData.currentInterest = currentInterest;
    if (message !== undefined) profileData.message = message;
    
    profileData.profileUpdatedAt = new Date().toISOString();
    
    await userRef.update(profileData);
    
    res.json({ message: 'Profile updated successfully' });
    
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// 全参加者のビンゴ状態取得エンドポイント（管理者用）
app.get('/api/events/:eventId/bingo-status', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    const participantsSnapshot = await db.collection('events').doc(eventId)
      .collection('event_participants').get();
    
    const bingoStatus = await Promise.all(
      participantsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const bingoCompleted = data.bingoCompleted || new Array(9).fill(false);
        const completedCount = bingoCompleted.filter(Boolean).length;
        
        // 実際のユーザー情報を取得
        const userDoc = await db.collection('users').doc(doc.id).get();
        const userData = userDoc.data();
        
        return {
          userId: doc.id,
          userName: userData?.name || data.userName,
          hasBingo: data.hasBingo || false,
          completedCount,
          totalCount: 9,
          progress: Math.round((completedCount / 9) * 100),
          bingoAchievedAt: data.bingoAchievedAt,
          bingoCompleted,
          bingoBoard: data.bingoBoard || [],
          bingoReady: data.bingoReady || false
        };
      })
    );
    
    // ビンゴ達成者を上に、進捗率順でソート
    bingoStatus.sort((a, b) => {
      if (a.hasBingo && !b.hasBingo) return -1;
      if (!a.hasBingo && b.hasBingo) return 1;
      return b.progress - a.progress;
    });

    res.json(bingoStatus);

  } catch (error: any) {
    console.error('Error getting bingo status:', error);
    res.status(500).json({ error: error.message });
  }
});

// AIアンケート質問サジェストエンドポイント
app.post('/api/ai/suggest-questions', async (req: Request, res: Response) => {
  console.log('=== AI Suggest Questions API Called ===');
  console.log('Request body:', req.body);
  
  try {
    const { eventName, eventType, count = 3 } = req.body;
    console.log('Extracted params:', { eventName, eventType, count });

    if (!eventName) {
      console.log('Missing eventName in request');
      return res.status(400).send('Event name is required');
    }

    const questionCount = Math.min(Math.max(count, 1), 10); // 1-10個の範囲で制限
    console.log('Calling generateAISurveyQuestions with count:', questionCount);
    const suggestions = await generateAISurveyQuestions(eventName, questionCount, eventType);
    console.log('Generated suggestions:', suggestions);
    
    const response = { 
      questions: suggestions.map((question, index) => ({
        id: index + 1,
        question
      }))
    };
    
    console.log('Sending response:', response);
    res.json(response);

  } catch (error: any) {
    console.error('=== ERROR in AI suggest questions API ===');
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
});

// 管理者ダッシュボード統計情報取得エンドポイント
app.get('/api/admin/stats', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    
    // 全イベント取得
    const eventsSnapshot = await db.collection('events').get();
    const totalEvents = eventsSnapshot.size;
    const activeEvents = eventsSnapshot.docs.filter(doc => doc.data().isActive).length;
    
    // 全イベントの参加者を取得してユニークユーザー数を計算
    const uniqueParticipants = new Set<string>();
    
    for (const eventDoc of eventsSnapshot.docs) {
      const participantsSnapshot = await db.collection('events').doc(eventDoc.id)
        .collection('event_participants').get();
      
      participantsSnapshot.docs.forEach(participantDoc => {
        uniqueParticipants.add(participantDoc.id);
      });
    }
    
    res.json({
      totalEvents,
      activeEvents,
      uniqueParticipants: uniqueParticipants.size
    });
    
  } catch (error: any) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// スキャン履歴取得エンドポイント
app.get('/api/events/:eventId/icebreak-history/:userId', async (req: Request, res: Response) => {
  try {
    const { eventId, userId } = req.params;
    const db = admin.firestore();
    
    const sessionsSnapshot = await db.collection('icebreakSessions')
      .where('eventId', '==', eventId)
      .where('status', '==', 'completed')
      .get();
    
    const userSessions = sessionsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.user1Id === userId || data.user2Id === userId;
      })
      .map(doc => {
        const data = doc.data();
        return {
          ...data.icebreakData,
          users: {
            user1: { name: data.user1Name },
            user2: { name: data.user2Name }
          },
          createdAt: data.createdAt,
          role: data.user1Id === userId ? 'initiator' : 'responder'
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(userSessions);
    
  } catch (error: any) {
    console.error('Error getting icebreak history:', error);
    res.status(500).json({ error: error.message });
  }
});

// 管理者用：全スキャン履歴取得エンドポイント
app.get('/api/events/:eventId/admin/icebreak-sessions', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    const sessionsSnapshot = await db.collection('icebreakSessions')
      .where('eventId', '==', eventId)
      .where('status', '==', 'completed')
      .get();
    
    const sessions = sessionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        user1Name: data.user1Name,
        user2Name: data.user2Name,
        topic: data.icebreakData?.topic,
        createdAt: data.createdAt,
        completedAt: data.completedAt
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(sessions);
    
  } catch (error: any) {
    console.error('Error getting admin icebreak sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Listening on all interfaces (0.0.0.0:${port})`);
});
// 管理者用：参加者のビンゴミッション再生成エンドポイント
app.post('/api/events/:eventId/participants/:userId/regenerate-bingo', async (req: Request, res: Response) => {
  try {
    const { eventId, userId } = req.params;
    const db = admin.firestore();
    
    // 参加者データを取得
    const participantDoc = await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).get();
    
    if (!participantDoc.exists) {
      return res.status(404).send('Participant not found');
    }
    
    const participantData = participantDoc.data();
    
    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }
    
    const userData = userDoc.data();
    
    console.log('=== Bingo Mission Generation Debug ===');
    console.log('User Profile:', userData);
    console.log('Survey Answers:', participantData?.answers);
    
    // AIビンゴミッションを生成
    const bingoMissions = await generateAIBingoMissions(
      userData,
      participantData?.answers || {}
    );
    
    console.log('Generated Bingo Missions:', bingoMissions);
    
    // ビンゴボードを更新（進捗はリセット）
    await db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId).update({
        bingoBoard: bingoMissions,
        bingoCompleted: new Array(9).fill(false),
        hasBingo: false,
        bingoReady: true,
        bingoAchievedAt: admin.firestore.FieldValue.delete()
      });
    
    res.json({ 
      message: 'Bingo missions regenerated successfully',
      bingoBoard: bingoMissions
    });
    
  } catch (error: any) {
    console.error('Error regenerating bingo missions:', error);
    res.status(500).json({ error: error.message });
  }
});
// 管理者用：全参加者のビンゴミッション一括生成エンドポイント
app.post('/api/events/:eventId/regenerate-all-bingo', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    // 全参加者を取得
    const participantsSnapshot = await db.collection('events').doc(eventId)
      .collection('event_participants').get();
    
    if (participantsSnapshot.empty) {
      return res.status(404).send('No participants found');
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`=== Bulk Bingo Mission Generation for ${participantsSnapshot.docs.length} participants ===`);
    
    // 各参加者のミッションを生成
    for (const participantDoc of participantsSnapshot.docs) {
      const userId = participantDoc.id;
      const participantData = participantDoc.data();
      
      try {
        // ユーザー情報を取得
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          console.error(`User not found: ${userId}`);
          errorCount++;
          results.push({ userId, userName: participantData.userName, success: false, error: 'User not found' });
          continue;
        }
        
        const userData = userDoc.data();
        
        // 管理者はスキップ（既にデフォルトミッションがある）
        if (userData?.role === 'admin') {
          console.log(`Skipping admin user: ${userData.name}`);
          results.push({ userId, userName: participantData.userName, success: true, skipped: true, reason: 'Admin user' });
          continue;
        }
        
        console.log(`Generating missions for: ${userData?.name}`);
        
        // AIビンゴミッションを生成
        const bingoMissions = await generateAIBingoMissions(
          userData,
          participantData?.answers || {}
        );
        
        // ビンゴボードを更新（進捗はリセット）
        await db.collection('events').doc(eventId)
          .collection('event_participants').doc(userId).update({
            bingoBoard: bingoMissions,
            bingoCompleted: new Array(9).fill(false),
            hasBingo: false,
            bingoReady: true,
            bingoAchievedAt: admin.firestore.FieldValue.delete()
          });
        
        successCount++;
        results.push({ 
          userId, 
          userName: participantData.userName, 
          success: true, 
          bingoBoard: bingoMissions 
        });
        
        console.log(`✓ Generated missions for ${userData?.name}`);
        
      } catch (error) {
        console.error(`Error generating missions for user ${userId}:`, error);
        errorCount++;
        results.push({ 
          userId, 
          userName: participantData.userName, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    console.log(`=== Bulk generation completed: ${successCount} success, ${errorCount} errors ===`);
    
    res.json({ 
      message: `Bulk bingo mission generation completed`,
      summary: {
        total: participantsSnapshot.docs.length,
        success: successCount,
        errors: errorCount
      },
      results
    });
    
  } catch (error: any) {
    console.error('Error in bulk bingo mission generation:', error);
    res.status(500).json({ error: error.message });
  }
});
// ユーザー権限更新エンドポイント
app.put('/api/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'participant'].includes(role)) {
      return res.status(400).send('Valid role (admin or participant) is required');
    }
    
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({ role });
    
    res.json({ message: 'User role updated successfully' });
    
  } catch (error: any) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: error.message });
  }
});

// ユーザー削除エンドポイント
app.delete('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();
    
    // Firebase Authenticationからユーザーを削除
    await admin.auth().deleteUser(userId);
    
    // Firestoreからユーザードキュメントを削除
    await db.collection('users').doc(userId).delete();
    
    // 全イベントから参加者として削除
    const eventsSnapshot = await db.collection('events').get();
    const batch = db.batch();
    
    for (const eventDoc of eventsSnapshot.docs) {
      const participantRef = db.collection('events').doc(eventDoc.id)
        .collection('event_participants').doc(userId);
      batch.delete(participantRef);
    }
    
    await batch.commit();
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// 画像アップロードエンドポイント
app.post('/api/events/:eventId/participants/:userId/bingo/:index/photo', async (req: Request, res: Response) => {
  try {
    const { eventId, userId, index } = req.params;
    const { imageData } = req.body;
    const bingoIndex = parseInt(index);
    
    if (!imageData) {
      return res.status(400).send('Image data is required');
    }
    
    const db = admin.firestore();
    const participantRef = db.collection('events').doc(eventId)
      .collection('event_participants').doc(userId);
    
    // 画像データを保存
    await participantRef.update({
      [`photoUploads.${bingoIndex}`]: {
        imageData,
        uploadedAt: new Date().toISOString()
      }
    });
    
    res.json({ message: 'Photo uploaded successfully' });
    
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: error.message });
  }
});

// 管理者用：全参加者の画像取得エンドポイント
app.get('/api/events/:eventId/photos', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const db = admin.firestore();
    
    const participantsSnapshot = await db.collection('events').doc(eventId)
      .collection('event_participants').get();
    
    const photosData = [];
    
    for (const participantDoc of participantsSnapshot.docs) {
      const data = participantDoc.data();
      const photoUploads = data.photoUploads || {};
      
      for (const [bingoIndex, photoData] of Object.entries(photoUploads)) {
        const missionIndex = parseInt(bingoIndex);
        const mission = data.bingoBoard?.[missionIndex];
        const missionText = typeof mission === 'string' ? mission : mission?.text;
        
        photosData.push({
          userId: participantDoc.id,
          userName: data.userName,
          bingoIndex: missionIndex,
          missionText,
          imageData: (photoData as any).imageData,
          uploadedAt: (photoData as any).uploadedAt
        });
      }
    }
    
    // アップロード時刻順でソート
    photosData.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    
    res.json(photosData);
    
  } catch (error: any) {
    console.error('Error getting photos:', error);
    res.status(500).json({ error: error.message });
  }
});
