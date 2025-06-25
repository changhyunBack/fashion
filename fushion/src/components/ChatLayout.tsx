
import { ChatSidebar } from './ChatSidebar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';
import { useMessages, Message } from '@/hooks/useMessages';

interface Thread {
  id: string;
  title: string;
}

interface ChatLayoutProps {
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

export const ChatLayout = ({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  isDarkMode,
  onToggleTheme,
  onLogout,
  updateThreadTitle,
}: ChatLayoutProps) => {
  const { messages, isStreaming, messagesEndRef, handleSendMessage, handleToggleSteps } = useMessages(
    activeThreadId,
    updateThreadTitle
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
        onDeleteThread={onDeleteThread}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        updateThreadTitle={updateThreadTitle}
      />
      
      <div className="flex-1 flex flex-col">
        {activeThreadId ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <EmptyState
                  title="새 대화를 시작하세요"
                  description="아래 입력창에 메시지를 입력해보세요."
                />
              ) : (
                <div>
                  {messages.map((message, index) => (
                    <ChatMessage 
                      key={index} 
                      message={message} 
                      onToggleSteps={message.role === 'assistant' ? handleToggleSteps : undefined}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isStreaming}
              placeholder={isStreaming ? "AI가 응답 중입니다..." : "메시지를 입력하세요..."}
            />
          </>
        ) : (
          <EmptyState
            title="대화를 선택하세요"
            description="좌측에서 대화를 선택하거나 새 대화를 시작해보세요."
          />
        )}
      </div>
    </div>
  );
};
