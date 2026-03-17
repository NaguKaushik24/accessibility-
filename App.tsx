import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sun, Moon, UploadCloud, Menu } from 'lucide-react';
import { ChatMessage, type Message, type Attachment } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { sendMessageStream, initChat, setChatHistory } from './services/gemini';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('isGuest') === 'true';
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    return localStorage.getItem('currentChatId') || null;
  });

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId);
    } else {
      localStorage.removeItem('currentChatId');
    }
  }, [currentChatId]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragCounter, setDragCounter] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1-sample silent WAV file to keep tab active in background
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.loop = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (isLoading && audioRef.current) {
      audioRef.current.play().catch(() => {});
    } else if (!isLoading && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isLoading]);

  useEffect(() => {
    initChat();
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        localStorage.removeItem('isGuest');
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleGuestMode = () => {
    setIsGuest(true);
    localStorage.setItem('isGuest', 'true');
  };

  const handleLogout = async () => {
    await auth.signOut();
    setIsGuest(false);
    localStorage.removeItem('isGuest');
    setMessages([]);
    setChats([]);
    setCurrentChatId(null);
  };

  // Fetch chats
  useEffect(() => {
    if (!isAuthReady || !user || isGuest) {
      setChats([]);
      if (!isGuest) setCurrentChatId(null);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Sort in memory to avoid needing a composite index in Firestore
      chatData.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA; // Descending
      });
      
      setChats(chatData);

      if (chatData.length > 0) {
        const currentExists = chatData.some(c => c.id === currentChatId);
        if (!currentExists) {
          setCurrentChatId(chatData[0].id);
        }
      } else {
        setCurrentChatId(null);
      }
    }, (error) => {
      console.error("Error fetching chats: ", error);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Fetch messages for current chat
  useEffect(() => {
    if (!isAuthReady || !user || !currentChatId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', currentChatId),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      // Sort in memory to avoid needing a composite index in Firestore
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      });

      setMessages(prev => {
        const streamingMsg = prev.find(m => m.isStreaming);
        
        if (!streamingMsg) {
          setChatHistory(msgs);
          return msgs;
        }

        const merged = msgs.map(m => 
          m.id === streamingMsg.id 
            ? { ...m, content: streamingMsg.content, isStreaming: true } 
            : m
        );
        
        if (!merged.find(m => m.id === streamingMsg.id)) {
          merged.push(streamingMsg);
        }
        
        return merged;
      });
    }, (error) => {
      console.error("Error fetching messages: ", error);
    });

    return () => unsubscribe();
  }, [currentChatId, user, isAuthReady]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev - 1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleNewChat = () => {
    setNewChatTitle('');
    setShowNewChatModal(true);
    setIsSidebarOpen(false);
  };

  const confirmNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatTitle.trim() || !user) return;
    
    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: newChatTitle.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(newChatRef.id);
      setMessages([]);
      setShowNewChatModal(false);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const handleSendMessage = async (content: string, currentAttachments: any[] = []) => {
    if ((!content.trim() && currentAttachments.length === 0) || isLoading || (!user && !isGuest)) return;

    setIsLoading(true);
    let chatId = currentChatId;

    // 1. Optimistic UI immediately for zero lag
    const userMsgId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();
    
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content, attachments: currentAttachments },
      { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true }
    ]);

    try {
      // 2. Ensure chat exists (only if logged in)
      let assistantMsgPromise: Promise<any> = Promise.resolve(null);
      
      if (user && !isGuest) {
        if (!chatId) {
          const newChatRef = await addDoc(collection(db, 'chats'), {
            userId: user.uid,
            title: content.substring(0, 40) || 'New Chat',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          chatId = newChatRef.id;
          setCurrentChatId(chatId);
        } else {
          updateDoc(doc(db, 'chats', chatId), {
            updatedAt: serverTimestamp()
          }).catch(console.error);
        }

        // 3. Fire off Firestore writes without awaiting them to block the stream
        addDoc(collection(db, 'messages'), {
          chatId,
          userId: user.uid,
          role: 'user',
          content,
          attachments: currentAttachments,
          createdAt: serverTimestamp()
        }).catch(console.error);

        assistantMsgPromise = addDoc(collection(db, 'messages'), {
          chatId,
          userId: user.uid,
          role: 'assistant',
          content: '',
          createdAt: serverTimestamp()
        });
      }

      // 4. Start stream immediately
      let fullResponse = '';
      let lastSaveTime = Date.now();
      let lastUIUpdateTime = Date.now();
      let assistantMsgRef: any = null;

      await sendMessageStream(content, currentAttachments, async (chunk) => {
        fullResponse += chunk;
        
        // Throttle UI updates to 10fps (every 100ms) for smoother performance
        if (Date.now() - lastUIUpdateTime > 100) {
          lastUIUpdateTime = Date.now();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        // Periodically save to Firestore (every 2 seconds) if logged in
        if (user && !isGuest && Date.now() - lastSaveTime > 2000) {
          lastSaveTime = Date.now();
          if (!assistantMsgRef) {
            assistantMsgRef = await assistantMsgPromise;
          }
          if (assistantMsgRef) {
            updateDoc(assistantMsgRef, { content: fullResponse }).catch(console.error);
          }
        }
      });

      // Final UI update to ensure full response is shown
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullResponse, isStreaming: false }
            : msg
        )
      );

      if (user && !isGuest && assistantMsgPromise) {
        if (!assistantMsgRef) {
          assistantMsgRef = await assistantMsgPromise;
        }
        if (assistantMsgRef) {
          await updateDoc(assistantMsgRef, { content: fullResponse });
        }
      }

    } catch (error: any) {
      console.error('Failed to send message:', error);
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.message?.includes('quota')) {
        errorMessage = 'API quota exceeded. Please wait a moment and try again.';
      } else if (error.message?.includes('safety')) {
        errorMessage = 'The response was blocked by safety filters. Please try rephrasing your question.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: errorMessage, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthReady) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent"></div></div>;
  }

  if (!isGuest && (!user || (!user.emailVerified && user.providerData[0]?.providerId === 'password'))) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Auth onLogin={() => {}} onGuest={handleGuestMode} />
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Create New Chat</h3>
            <form onSubmit={confirmNewChat}>
              <input
                type="text"
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                placeholder="Enter chat name..."
                className="mb-4 w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-2 text-black focus:border-black focus:outline-none dark:border-neutral-700 dark:text-white dark:focus:border-white"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChatTitle.trim()}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex h-[100dvh] overflow-hidden bg-neutral-50 dark:bg-[#0a0a0a] font-sans text-black dark:text-white transition-colors duration-200">
        
        <Sidebar 
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={setCurrentChatId}
          onNewChat={handleNewChat}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          isGuest={isGuest}
          onLogin={() => setIsGuest(false)}
          onLogout={handleLogout}
        />

        <div 
          className="relative flex flex-1 flex-col overflow-hidden"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          {dragCounter > 0 && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-white/10">
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8 dark:bg-neutral-900">
                <div className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-neutral-100 text-black dark:bg-neutral-800 dark:text-white">
                  <UploadCloud className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-black dark:text-white">Drop files here</h3>
                <p className="mt-2 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  Images, PDFs, and text files are supported
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] px-4 shadow-sm sm:px-6 lg:px-8 transition-colors duration-200">
            <div className="flex items-center gap-2">
              <button 
                className="mr-2 md:hidden p-2 -ml-2 text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black dark:bg-white text-white dark:text-black">
                <Bot size={20} />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-black dark:text-white hidden sm:block">
                Accessibility Fun
              </h1>
            </div>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </header>

          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white">
                  <Bot size={32} />
                </div>
                <h2 className="mb-2 text-xl sm:text-2xl font-semibold tracking-tight text-black dark:text-white">
                  Welcome to Accessibility Fun
                </h2>
                <p className="mb-6 sm:mb-8 max-w-md text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                  I'm your expert assistant for WCAG, Section 508, ARIA, and assistive technologies. How can I help you make the web more accessible today?
                </p>
                <div className="grid w-full max-w-2xl gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <button
                    onClick={() => handleSendMessage('Show me how to create an accessible radio button group')}
                    className="flex flex-col items-start rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="font-medium text-black dark:text-white">Accessible Forms</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Create an accessible radio button group</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('What are the keystrokes to navigate table cells in the JAWS screen reader?')}
                    className="flex flex-col items-start rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="font-medium text-black dark:text-white">Screen Readers</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">JAWS table navigation keystrokes</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('Do these colors pass color contrast requirements? #249DFF #FFFFFF')}
                    className="flex flex-col items-start rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="font-medium text-black dark:text-white">Color Contrast</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Check #249DFF and #FFFFFF</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('Give me a decision tree to decide if an image needs alt text')}
                    className="flex flex-col items-start rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="font-medium text-black dark:text-white">Alt Text</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Decision tree for image alt text</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col pb-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </main>

          {/* Input Area */}
          <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] transition-colors duration-200">
            <ChatInput 
              onSend={handleSendMessage} 
              disabled={isLoading} 
              attachments={attachments}
              setAttachments={setAttachments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
