import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Paperclip, X } from 'lucide-react';
import { Attachment } from './ChatMessage';
import { cn } from './ChatMessage';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  disabled?: boolean;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

export function ChatInput({ onSend, disabled, attachments, setAttachments }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !disabled) {
      onSend(input.trim(), attachments);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        setAttachments((prev) => [
          ...prev,
          {
            mimeType: file.type,
            data: base64String,
            url: URL.createObjectURL(file),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        e.preventDefault();
        processFiles(imageFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAtt = [...prev];
      URL.revokeObjectURL(newAtt[index].url);
      newAtt.splice(index, 1);
      return newAtt;
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 pt-4 pb-4 sm:pb-8 lg:px-8">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative h-16 w-16 rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {att.mimeType.startsWith('image/') ? (
                <img src={att.url} alt="attachment preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-500">
                  FILE
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full items-end gap-2 rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-2 shadow-sm focus-within:border-black focus-within:ring-1 focus-within:ring-black dark:focus-within:border-white dark:focus-within:ring-white transition-colors"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="mb-1 flex h-10 w-10 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          <Paperclip size={20} className="sm:w-[18px] sm:h-[18px]" />
          <span className="sr-only">Attach file</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
          accept="image/*,.pdf,.txt,.csv"
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask about WCAG, ARIA, JAWS, color contrast..."
          className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent py-3 pl-2 pr-12 text-sm sm:text-base text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none"
          rows={1}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={(!input.trim() && attachments.length === 0) || disabled}
          className="absolute bottom-3 right-3 flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md bg-black text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600"
        >
          <SendHorizontal size={18} />
          <span className="sr-only">Send message</span>
        </button>
      </form>
      <div className="mt-2 px-2 text-center text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">
        Accessibility Fun can make mistakes. Verify important guidelines.
      </div>
    </div>
  );
}
