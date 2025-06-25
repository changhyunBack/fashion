
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useStreamingChat } from './useStreamingChat';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: string;
  isStreaming?: boolean;
  steps?: any[];
  showSteps?: boolean;
}

export const useMessages = (activeThreadId: string | null, updateThreadTitle: (threadId: string, title: string) => Promise<void>) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleMessageComplete = (content: string) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = content;
        lastMessage.isStreaming = false;
      }
      return newMessages;
    });
  };

  const { streamingState, sendStreamingMessage, toggleSteps } = useStreamingChat(
    activeThreadId,
    handleMessageComplete
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingState.currentContent]);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  const loadMessages = async (threadId: string) => {
    try {
      const messagesData = await apiClient.getMessages(threadId);
      setMessages(messagesData.map(msg => ({
        ...msg,
        timestamp: new Date().toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      })));
    } catch (error) {
      toast({
        title: "오류",
        description: "메시지를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string, image?: string) => {
    if (!activeThreadId) return;

    const newUserMessage: Message = {
      role: 'user',
      content,
      image,
      timestamp: new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    setMessages(prev => [...prev, newUserMessage]);

    // 스트리밍 어시스턴트 메시지 추가
    const streamingMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isStreaming: true,
      steps: [],
      showSteps: false
    };

    setMessages(prev => [...prev, streamingMessage]);

    try {
      await sendStreamingMessage(content, image);

      // 첫 번째 메시지인 경우 스레드 제목 업데이트
      if (messages.length === 0) {
        const updatedTitle = content.slice(0, 30);
        await updateThreadTitle(activeThreadId, updatedTitle);
      }

    } catch (error) {
      toast({
        title: "오류",
        description: "메시지 전송에 실패했습니다.",
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -1)); // 스트리밍 메시지 제거
    }
  };

  const handleToggleSteps = () => {
    toggleSteps();
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.showSteps = streamingState.showSteps;
        lastMessage.steps = streamingState.steps;
      }
      return newMessages;
    });
  };

  // 스트리밍 상태를 메시지에 반영
  const displayMessages = messages.map((msg, index) => {
    if (index === messages.length - 1 && msg.role === 'assistant' && streamingState.isStreaming) {
      return {
        ...msg,
        content: streamingState.currentContent,
        isStreaming: true,
        steps: streamingState.steps,
        showSteps: streamingState.showSteps
      };
    }
    return msg;
  });

  return {
    messages: displayMessages,
    isStreaming: streamingState.isStreaming,
    messagesEndRef,
    handleSendMessage,
    handleToggleSteps,
  };
};
