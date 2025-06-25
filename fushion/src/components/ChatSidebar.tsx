
import { Plus, MessageSquare, User, Sun, Moon, LogOut, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface Thread {
  id: string;
  title: string;
}

interface ChatSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  updateThreadTitle: (threadId: string, title: string) => Promise<void>;
}

export const ChatSidebar = ({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  isDarkMode,
  onToggleTheme,
  onLogout,
  updateThreadTitle
}: ChatSidebarProps) => {
  const { toast } = useToast();
  const userId = apiClient.getUserId();
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleLogout = () => {
    apiClient.logout();
    onLogout();
    toast({
      title: "로그아웃",
      description: "성공적으로 로그아웃되었습니다.",
    });
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteThread(threadId);
      onDeleteThread(threadId);
      toast({
        title: "대화 삭제",
        description: "대화가 삭제되었습니다.",
      });
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "대화 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (threadId: string, currentTitle: string) => {
    setEditingThread(threadId);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = async (threadId: string) => {
    if (editTitle.trim()) {
      try {
        await updateThreadTitle(threadId, editTitle.trim());
        toast({
          title: "제목 변경",
          description: "대화 제목이 변경되었습니다.",
        });
      } catch (error) {
        toast({
          title: "변경 실패",
          description: "제목 변경에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
    setEditingThread(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingThread(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(threadId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="w-80 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <Button 
          onClick={onNewThread}
          className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4" />
          새 대화
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {threads.map((thread) => (
            <ContextMenu key={thread.id}>
              <ContextMenuTrigger>
                <div
                  onClick={() => onSelectThread(thread.id)}
                  className={`sidebar-item group relative ${
                    activeThreadId === thread.id 
                      ? 'bg-sidebar-accent' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-sidebar-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingThread === thread.id ? (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveEdit(thread.id)}
                          onKeyDown={(e) => handleKeyDown(e, thread.id)}
                          className="text-sm h-6 p-1"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm font-medium text-sidebar-foreground truncate">
                          {thread.title}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleStartEdit(thread.id, thread.title)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  이름 변경
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => handleDeleteThread(thread.id, {} as React.MouseEvent)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </div>

      {/* User Profile & Settings */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground">
                {userId || '사용자'}
              </div>
              <div className="text-xs text-sidebar-foreground/60">
                접속 중
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              className="p-2"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="p-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
