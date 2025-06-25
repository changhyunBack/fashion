
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
      let buffer = '';

      let doneStreaming = false;
      while (!doneStreaming) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith('[STEP]')) {
            steps.push({
              type: 'step',
              content: line.replace('[STEP]', '').trim()
            });
            setStreamingState(prev => ({
              ...prev,
              steps: [...steps]
            }));
          } else if (line.startsWith('[OBS]')) {
            steps.push({
              type: 'observation',
              content: line.replace('[OBS]', '').trim()
            });
            setStreamingState(prev => ({
              ...prev,
              steps: [...steps]
            }));
          } else if (line === '[DONE]') {
            doneStreaming = true;
            break;
          } else if (line) {
            accumulatedContent += line;
            setStreamingState(prev => ({
              ...prev,
              currentContent: accumulatedContent
            }));
          }
        }

        // 남은 버퍼가 이벤트가 아니라면 일반 응답으로 처리
        if (
          buffer &&
          !buffer.startsWith('[STEP]') &&
          !buffer.startsWith('[OBS]') &&
          buffer != '[DONE]'
        ) {
          accumulatedContent += buffer;
          setStreamingState(prev => ({
            ...prev,
            currentContent: accumulatedContent
          }));
          buffer = '';
        }
      }

      if (buffer && buffer !== '[DONE]') {
        accumulatedContent += buffer;
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
