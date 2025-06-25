
import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from './ImageUpload';

interface ChatInputProps {
  onSendMessage: (content: string, image?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({ 
  onSendMessage, 
  disabled = false,
  placeholder = "메시지를 입력하세요..." 
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), selectedImage || undefined);
      setMessage('');
      setSelectedImage(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-3 p-3 bg-muted/30 rounded-xl border">
            <ImageUpload 
              onImageSelect={setSelectedImage}
              selectedImage={selectedImage}
            />
            
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-[40px] max-h-40 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            
            <Button
              type="submit"
              size="sm"
              disabled={disabled || !message.trim()}
              className="flex-shrink-0 p-2"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
        
        <div className="text-xs text-muted-foreground text-center mt-2">
          Enter를 눌러 전송, Shift+Enter로 줄바꿈
        </div>
      </div>
    </div>
  );
};
