import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Attachment {
  mimeType: string;
  data: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  attachments?: Attachment[];
  createdAt?: any;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
        isUser ? 'bg-white dark:bg-[#0a0a0a]' : 'bg-neutral-50 dark:bg-[#141414]'
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-4 md:gap-6">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-sm',
            isUser
              ? 'bg-white border-neutral-200 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300'
              : 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-black'
          )}
        >
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>
        <div className="flex-1 space-y-2 overflow-hidden px-1">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, idx) => (
                <div key={idx} className="h-32 w-32 rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  {att.mimeType.startsWith('image/') ? (
                    <img src={att.url} alt="attachment" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-500">
                      Document
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="prose prose-neutral max-w-none break-words text-black dark:text-white dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
            <Markdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </Markdown>
            {message.isStreaming && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-black dark:bg-white align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
