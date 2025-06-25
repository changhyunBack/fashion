
import { useState, useEffect } from 'react';
import { ChatLayout } from './ChatLayout';
import { LoginForm } from './LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { useThreads } from '@/hooks/useThreads';

export const ChatInterface = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { isAuthenticated, handleLogin, handleLogout } = useAuth();
  const { 
    threads, 
    activeThreadId, 
    handleNewThread, 
    handleSelectThread, 
    handleDeleteThread,
    updateThreadTitle 
  } = useThreads(isAuthenticated);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleLogoutWithCleanup = () => {
    handleLogout();
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <ChatLayout
      threads={threads}
      activeThreadId={activeThreadId}
      onSelectThread={handleSelectThread}
      onNewThread={handleNewThread}
      onDeleteThread={handleDeleteThread}
      isDarkMode={isDarkMode}
      onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      onLogout={handleLogoutWithCleanup}
      updateThreadTitle={updateThreadTitle}
    />
  );
};
