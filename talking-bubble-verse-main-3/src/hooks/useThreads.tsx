
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Thread {
  id: string;
  title: string;
}

export const useThreads = (isAuthenticated: boolean) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      loadThreads();
    }
  }, [isAuthenticated]);

  const loadThreads = async () => {
    try {
      const threadsData = await apiClient.getThreads();
      setThreads(threadsData);
      if (threadsData.length > 0 && !activeThreadId) {
        setActiveThreadId(threadsData[0].id);
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "대화 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleNewThread = async () => {
    try {
      const newThread = await apiClient.createThread();
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
    } catch (error) {
      toast({
        title: "오류",
        description: "새 대화를 만드는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
  };

  const handleDeleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (activeThreadId === threadId) {
      const remainingThreads = threads.filter(t => t.id !== threadId);
      setActiveThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null);
    }
  };

  const updateThreadTitle = async (threadId: string, title: string) => {
    await apiClient.renameThread(threadId, title);
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, title } : t
    ));
  };

  return {
    threads,
    activeThreadId,
    handleNewThread,
    handleSelectThread,
    handleDeleteThread,
    updateThreadTitle,
  };
};
