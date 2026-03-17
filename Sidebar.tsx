import React from 'react';
import { MessageSquare, Plus, LogOut, Menu, X } from 'lucide-react';
import { auth } from '../firebase';

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
}

interface SidebarProps {
  chats: ChatSession[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isGuest: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function Sidebar({ 
  chats, 
  currentChatId, 
  onSelectChat, 
  onNewChat, 
  isOpen, 
  setIsOpen,
  isGuest,
  onLogin,
  onLogout
}: SidebarProps) {
  const handleLogout = () => {
    onLogout();
  };

  // Group chats by date (Today, Yesterday, Previous 7 Days, Older)
  const groupChats = () => {
    const groups: { [key: string]: ChatSession[] } = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;

    chats.forEach(chat => {
      if (!chat.createdAt) return;
      const chatTime = chat.createdAt.toDate().getTime();
      
      if (chatTime >= today) {
        groups['Today'].push(chat);
      } else if (chatTime >= yesterday) {
        groups['Yesterday'].push(chat);
      } else if (chatTime >= lastWeek) {
        groups['Previous 7 Days'].push(chat);
      } else {
        groups['Older'].push(chat);
      }
    });

    return groups;
  };

  const groupedChats = groupChats();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-neutral-50 dark:bg-[#141414] border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:static md:w-64 lg:w-72
      `}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={onNewChat}
            className="flex flex-1 items-center gap-2 rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            <Plus size={16} />
            New Chat
          </button>
          <button 
            className="ml-2 md:hidden p-2 text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {isGuest ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="h-10 w-10 text-neutral-300 mb-4" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Login to save your chat history and access it from any device.
              </p>
              <button
                onClick={onLogin}
                className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Sign In
              </button>
            </div>
          ) : (
            Object.entries(groupedChats).map(([label, groupChats]) => {
              if (groupChats.length === 0) return null;
              return (
                <div key={label}>
                  <h3 className="mb-2 px-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {label}
                  </h3>
                  <div className="space-y-1">
                    {groupChats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          onSelectChat(chat.id);
                          setIsOpen(false);
                        }}
                        className={`
                          flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left truncate
                          ${currentChatId === chat.id 
                            ? 'bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white' 
                            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/50'}
                        `}
                      >
                        <MessageSquare size={16} className="shrink-0" />
                        <span className="truncate">{chat.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
