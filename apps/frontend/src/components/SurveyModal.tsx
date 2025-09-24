"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/contexts/ToastContext";

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: { question: string; answer: string }[]) => void;
  questions: { id: number; question: string }[];
}

export default function SurveyModal({ isOpen, onClose, onSubmit, questions }: SurveyModalProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const unanswered = questions.find(q => !answers[q.id]?.trim());
    if (unanswered) {
      showToast("すべての質問にお答えください", 'info');
      return;
    }

    const formattedAnswers = questions.map(q => ({
      question: q.question,
      answer: answers[q.id]
    }));

    onSubmit(formattedAnswers);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">アンケート</CardTitle>
          <p className="text-sm text-gray-600 text-center">
            より良い交流のために、簡単なアンケートにお答えください
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {questions.map((question) => (
              <div key={question.id}>
                <Label htmlFor={`q${question.id}`}>{question.question}</Label>
                <Input
                  id={`q${question.id}`}
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  placeholder="お答えください"
                  className="mt-1"
                />
              </div>
            ))}
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                後で
              </Button>
              <Button type="submit" className="flex-1">
                送信
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
