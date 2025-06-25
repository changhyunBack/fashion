
import { useState } from 'react';
import { User, Bot, Copy, Check, X, Wrench, Eye } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StreamStep } from '@/hooks/useStreamingChat';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: string;
  isStreaming?: boolean;
  steps?: StreamStep[];
  showSteps?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onToggleSteps?: () => void;
}

export const ChatMessage = ({ message, onToggleSteps }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';

  return (
    <>
      <div className={`chat-message py-6 px-4 ${isUser ? 'bg-muted/30' : 'bg-background'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <Avatar className="w-8 h-8">
                {isUser ? (
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                ) : (
                  <AvatarFallback className="bg-emerald-600 text-white">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                )}
              </Avatar>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">
                  {isUser ? '나' : 'ChatGPT'}
                </span>
                {message.timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp}
                  </span>
                )}
              </div>

              {/* Image */}
              {message.image && (
                <div className="mb-3">
                  <img 
                    src={message.image} 
                    alt="업로드된 이미지" 
                    className="max-w-sm rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImageFullscreen(true)}
                  />
                </div>
              )}

              {/* Steps (Tool Logs) */}
              {!isUser && message.steps && message.steps.length > 0 && (
                <div className="mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleSteps}
                    className="mb-2"
                  >
                    <Wrench className="w-3 h-3 mr-2" />
                    도구 사용 로그 ({message.steps.length})
                    <Eye className="w-3 h-3 ml-2" />
                  </Button>
                  
                  {message.showSteps && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      {message.steps.map((step, index) => (
                        <div key={index} className={`p-2 rounded ${
                          step.type === 'step' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                            : 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                        }`}>
                          <div className="font-medium">
                            {step.type === 'step' ? '🔧 도구 호출' : '📋 결과'}
                          </div>
                          <div className="text-xs mt-1">{step.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans">
                  {message.content}
                  {message.isStreaming && (
                    <span className="typing-indicator ml-1">
                      <span className="typing-dot" style={{'--delay': 0} as any}></span>
                      <span className="typing-dot" style={{'--delay': 1} as any}></span>
                      <span className="typing-dot" style={{'--delay': 2} as any}></span>
                    </span>
                  )}
                </pre>
              </div>

              {/* Actions */}
              {!isUser && (
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Overlay */}
      {imageFullscreen && message.image && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-full max-h-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImageFullscreen(false)}
              className="absolute -top-12 right-0 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
            <img 
              src={message.image} 
              alt="업로드된 이미지 (전체화면)" 
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
};
