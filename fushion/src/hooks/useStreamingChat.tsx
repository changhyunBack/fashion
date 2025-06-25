
import { useState, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface StreamStep {
  type: 'step' | 'observation';
  content: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentContent: string;
  steps: StreamStep[];
  showSteps: boolean;
}

export const useStreamingChat = (
  activeThreadId: string | null,
  onMessageComplete: (content: string) => void
) => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentContent: '',
    steps: [],
    showSteps: false,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const sendStreamingMessage = async (content: string, image?: string) => {
    if (!activeThreadId) return;

    // 이전 스트림 중단
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    setStreamingState({
      isStreaming: true,
      currentContent: '',
      steps: [],
      showSteps: false,
    });

    try {
      const response = await fetch(`${apiClient['API_BASE'] || 'http://localhost:8000'}/chat/stream`, {
        method: 'POST',
        headers: apiClient['getHeaders'](),
        body: JSON.stringify({
          thread_id: activeThreadId,
          question: content,
          image: image
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      const steps: StreamStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('[STEP]')) {
            // 도구 호출 시작
            steps.push({
              type: 'step',
              content: line.replace('[STEP]', '').trim()
            });
            setStreamingState(prev => ({
              ...prev,
              steps: [...steps]
            }));
          } else if (line.startsWith('[OBS]')) {
            // 도구 결과
            steps.push({
              type: 'observation',
              content: line.replace('[OBS]', '').trim()
            });
            setStreamingState(prev => ({
              ...prev,
              steps: [...steps]
            }));
          } else if (line === '[DONE]') {
            // 스트리밍 완료
            break;
          } else if (line.trim()) {
            // 일반 응답 내용
            accumulatedContent += line;
            setStreamingState(prev => ({
              ...prev,
              currentContent: accumulatedContent
            }));
          }
        }
      }

      setStreamingState(prev => ({
        ...prev,
        isStreaming: false
      }));

      onMessageComplete(accumulatedContent);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // 사용자가 중단한 경우
      }
      
      console.error('Streaming error:', error);
      toast({
        title: "오류",
        description: "메시지 전송에 실패했습니다.",
        variant: "destructive",
      });
      
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        currentContent: '',
        steps: []
      }));
    }
  };

  const toggleSteps = () => {
    setStreamingState(prev => ({
      ...prev,
      showSteps: !prev.showSteps
    }));
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false
    }));
  };

  return {
    streamingState,
    sendStreamingMessage,
    toggleSteps,
    stopStreaming,
  };
};
