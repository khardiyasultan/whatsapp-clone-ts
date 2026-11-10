import {
  saveChatWallpapers,
  loadSettings,
  saveSettings,
  saveChats,
  loadChats,
  loadActiveChatId,
  saveActiveChatId,
} from "./utils/storage";
import { connectSocket, type ChatSocket } from "./utils/socket";
import { apiRequest } from "./utils/api";
import type { AuthUser } from "./utils/api";

import ChatSidebar from "./components/ChatSidebar";
import { useCallback, useEffect, useRef, useState } from "react";

import { useChatMessages } from "./hooks/useChatMessages";
import ContactInfoPanel from "./components/ContactInfoPanel";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import MessageComposer from "./components/MessageComposer";
import type { Message, Chat, UserSettings } from "./types/chat";
import "./App.css";

const defaultSettings: UserSettings = {
  theme: "dark",
  chatBackground: "#0b141a",
  fontSize: "medium",
};

const initialChats: Chat[] = [
  {
    id: 1,
    name: "Alex",
    status: "online",
    message: "I'm doing great!",
    messages: [
      { id: 1, text: "Hey! How are you?", sender: "them", time: "10:30 pm" },
      {
        id: 2,
        text: "I'm good! How about you?",
        sender: "me",
        time: "10:30 pm",
      },
      { id: 3, text: "I'm doing great!", sender: "them", time: "10:31 pm" },
    ],
  },
  {
    id: 2,
    name: "Sarah",
    status: "offline",
    message: "See you tomorrow!",
    messages: [
      { id: 1, text: "Hi!", sender: "them", time: "10:30 pm" },
      { id: 2, text: "See you tomorrow!", sender: "me", time: "10:30 pm" },
    ],
  },
  {
    id: 3,
    name: "John",
    status: "online",
    message: "Thanks!",
    messages: [
      {
        id: 1,
        text: "Can you send me the notes?",
        sender: "them",
        time: "10:30 pm",
      },
      { id: 2, text: "Thanks!", sender: "them", time: "10:31 pm" },
    ],
  },
];

type AppProps = {
  user: AuthUser;
};

type BackendParticipant = {
  _id: string;
  name: string;
  profilePhoto?: string;
  about?: string;
};

type BackendConversation = {
  _id: string;
  participants: BackendParticipant[];
  updatedAt: string;
};

type ConversationsResponse = {
  success: boolean;
  conversations: BackendConversation[];
};

type BackendMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
  clientMessageId: string;
};

type MessagesResponse = {
  success: boolean;
  count: number;
  hasMore: boolean;
  nextCursor?: string | null;
  messages: BackendMessage[];
};

function isWindowFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function formatMessageTime(date: string): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App({ user }: AppProps) {
  const [showStarredMessages, setShowStarredMessages] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardTargetChatId, setForwardTargetChatId] = useState<number | null>(
    null,
  );

  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingConversationIdRef = useRef<string | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [chats, setChats] = useState<Chat[]>(() => loadChats(initialChats));
  const [conversationsLoaded, setConversationsLoaded] = useState(false);

  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);

  const [mutedChats, setMutedChats] = useState<number[]>(() => {
    const saved = localStorage.getItem("mutedChats");
    return saved ? (JSON.parse(saved) as number[]) : [];
  });

  const [favoriteChats, setFavoriteChats] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteChats");
    return saved ? (JSON.parse(saved) as number[]) : [];
  });

  const [activeChatId, setActiveChatId] = useState<number | null>(
    () => loadActiveChatId() ?? 1,
  );

  const {
    selectedMessageIds,
    selectMessagesMode,
    setSelectMessagesMode,
    toggleMessageSelection,
    deleteSelectedMessages,
    clearSelection,
    clearChatMessages,
    forwardSelectedMessages,
  } = useChatMessages(chats, setChats, activeChatId);

  const handleTypingStart = () => {
    console.log("FRONTEND: TYPING START CALLED");
    console.log("FRONTEND: TYPING STOP CALLED");
    const conversationId = activeChat?.backendId;

    if (!conversationId) return;

    const socket = connectSocket();

    // Emit typing:start only once for this conversation.
    if (typingConversationIdRef.current !== conversationId) {
      socket.emit("typing:start", { conversationId });
      typingConversationIdRef.current = conversationId;
      setIsTyping(true);
    }

    // Reset the inactivity timer after every keystroke.
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (typingConversationIdRef.current === conversationId) {
        socket.emit("typing:stop", { conversationId });
        typingConversationIdRef.current = null;
        setIsTyping(false);
      }

      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const conversationId = typingConversationIdRef.current;

    if (conversationId) {
      connectSocket().emit("typing:stop", { conversationId });
      typingConversationIdRef.current = null;
    }

    setIsTyping(false);
  };

  const [chatSearch, setChatSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const currentUserId = user._id ?? user.id;

  // --------------------------------------------------
  // REFS
  // --------------------------------------------------

  const activeBackendIdRef = useRef<string | undefined>(activeChat?.backendId);

  const chatsRef = useRef<Chat[]>(chats);

  // Prevent duplicate delivery/read acknowledgements.
  const deliveredReceiptIdsRef = useRef<Set<string>>(new Set());
  const readReceiptIdsRef = useRef<Set<string>>(new Set());

  activeBackendIdRef.current = activeChat?.backendId;
  chatsRef.current = chats;

  // Stop the previous conversation's typing indicator when switching chats.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const conversationId = typingConversationIdRef.current;

      if (conversationId) {
        connectSocket().emit("typing:stop", { conversationId });
        typingConversationIdRef.current = null;
        setIsTyping(false);
      }
    };
  }, [activeChat?.backendId]);

  // --------------------------------------------------
  // RECEIPT HELPERS
  // --------------------------------------------------

  const acknowledgeDelivered = useCallback((messageId: string) => {
    if (deliveredReceiptIdsRef.current.has(messageId)) {
      return;
    }

    deliveredReceiptIdsRef.current.add(messageId);

    try {
      const socket = connectSocket();

      socket.emit("message:delivered", { messageId }, (response) => {
        if (!response.success) {
          deliveredReceiptIdsRef.current.delete(messageId);
          console.error("Delivery acknowledgement failed:", response.message);
        }
      });
    } catch (error) {
      deliveredReceiptIdsRef.current.delete(messageId);
      console.error("Delivery acknowledgement error:", error);
    }
  }, []);

  const acknowledgeRead = useCallback((messageId: string) => {
    if (readReceiptIdsRef.current.has(messageId)) {
      return;
    }

    console.log("READ ACK TRIGGERED:", messageId);

    readReceiptIdsRef.current.add(messageId);

    try {
      const socket = connectSocket();

      socket.emit("message:read", { messageId }, (response) => {
        if (!response.success) {
          readReceiptIdsRef.current.delete(messageId);
          console.error("Read acknowledgement failed:", response.message);
        }
      });
    } catch (error) {
      readReceiptIdsRef.current.delete(messageId);
      console.error("Read acknowledgement error:", error);
    }
  }, []);

  // --------------------------------------------------
  // 1. LOAD CONVERSATIONS
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        const data = await apiRequest<ConversationsResponse>(
          "/conversations",
          {},
          true,
        );

        if (cancelled) return;

        const loggedInUserId = user._id ?? user.id;

        if (!loggedInUserId) {
          throw new Error("Current user ID is missing.");
        }

        const mappedChats: Chat[] = data.conversations.map(
          (conversation, index) => {
            const otherUser = conversation.participants.find(
              (participant) => participant._id !== loggedInUserId,
            );

            return {
              id: index + 1,
              backendId: conversation._id,
              name: otherUser?.name ?? "Unknown User",
              message: "",
              messages: [],
              profilePhoto: otherUser?.profilePhoto,
              about: otherUser?.about,
              status: "offline",
            };
          },
        );

        setChats(mappedChats);
        setConversationsLoaded(true);

        const savedActiveChatId = loadActiveChatId();

        if (
          savedActiveChatId !== null &&
          mappedChats.some((chat) => chat.id === savedActiveChatId)
        ) {
          setActiveChatId(savedActiveChatId);
        } else {
          setActiveChatId(mappedChats[0]?.id ?? null);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // --------------------------------------------------
  // 2. HANDLE NEW CONVERSATIONS
  // --------------------------------------------------

  useEffect(() => {
    const socket = connectSocket();

    async function handleNewConversation(data: { conversationId: string }) {
      try {
        const response = await apiRequest<ConversationsResponse>(
          "/conversations",
          {},
          true,
        );

        const loggedInUserId = user._id ?? user.id;

        setChats((previousChats) => {
          let nextId =
            previousChats.reduce((maxId, chat) => Math.max(maxId, chat.id), 0) +
            1;

          return response.conversations.map((conversation) => {
            const existingChat = previousChats.find(
              (chat) => chat.backendId === conversation._id,
            );

            const otherParticipant = conversation.participants.find(
              (participant) => participant._id !== loggedInUserId,
            );

            return {
              ...existingChat,
              id: existingChat?.id ?? nextId++,
              backendId: conversation._id,
              name: otherParticipant?.name ?? "Unknown",
              message: existingChat?.message ?? "",
              messages: existingChat?.messages ?? [],
              status: existingChat?.status ?? "offline",
              ...(otherParticipant?.profilePhoto
                ? { profilePhoto: otherParticipant.profilePhoto }
                : {}),
              ...(otherParticipant?.about
                ? { about: otherParticipant.about }
                : {}),
            };
          });
        });

        console.log("New conversation received:", data.conversationId);
      } catch (error) {
        console.error("Failed to reload conversations:", error);
      }
    }

    socket.on("conversation:new", handleNewConversation);

    return () => {
      socket.off("conversation:new", handleNewConversation);
    };
  }, [user]);

  // --------------------------------------------------
  // 3. LOAD ACTIVE CONVERSATION MESSAGES
  // --------------------------------------------------

  useEffect(() => {
    const activeBackendId = activeChat?.backendId;

    if (!conversationsLoaded || !activeBackendId) return;

    let cancelled = false;

    async function loadMessages() {
      try {
        const data = await apiRequest<MessagesResponse>(
          `/messages/${activeBackendId}`,
          { cache: "no-store" },
          true,
        );

        if (cancelled) return;

        const loggedInUserId = user._id ?? user.id;

        if (!loggedInUserId) {
          throw new Error("Current user ID is missing.");
        }

        const mappedMessages: Message[] = data.messages.map(
          (backendMessage, index) => ({
            id: index + 1,
            backendId: backendMessage._id,
            clientMessageId: backendMessage.clientMessageId,
            text: backendMessage.text,
            sender: backendMessage.senderId === loggedInUserId ? "me" : "them",
            time: formatMessageTime(backendMessage.createdAt),
            status: backendMessage.status,
          }),
        );

        // Messages fetched after reconnect/opening a chat
        // must also be acknowledged as delivered.
        mappedMessages.forEach((message) => {
          if (
            message.sender === "them" &&
            message.backendId &&
            message.status === "sent"
          ) {
            acknowledgeDelivered(message.backendId);
          }
        });

        // Opening an active, focused chat marks incoming messages as read.
        if (
          isWindowFocused() &&
          activeBackendIdRef.current === activeBackendId
        ) {
          mappedMessages.forEach((message) => {
            if (
              message.sender === "them" &&
              message.backendId &&
              message.status !== "read"
            ) {
              acknowledgeRead(message.backendId);
            }
          });
        }

        // Merge fetched messages with socket messages that may have
        // arrived while the HTTP request was in progress.
        setChats((previousChats) =>
          previousChats.map((chat) => {
            if (chat.backendId !== activeBackendId) return chat;

            const fetchedBackendIds = new Set(
              mappedMessages
                .map((message) => message.backendId)
                .filter((id): id is string => Boolean(id)),
            );

            const fetchedClientIds = new Set(
              mappedMessages
                .map((message) => message.clientMessageId)
                .filter((id): id is string => Boolean(id)),
            );

            const socketMessagesNotInFetch = chat.messages.filter(
              (message) =>
                (message.backendId &&
                  !fetchedBackendIds.has(message.backendId)) ||
                (message.clientMessageId &&
                  !fetchedClientIds.has(message.clientMessageId)),
            );

            const mergedMessages = [
              ...mappedMessages,
              ...socketMessagesNotInFetch,
            ];

            return {
              ...chat,
              messages: mergedMessages,
              message: mergedMessages.at(-1)?.text ?? "",
            };
          }),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load messages:", error);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [
    activeChat?.backendId,
    conversationsLoaded,
    user,
    acknowledgeDelivered,
    acknowledgeRead,
  ]);

  // --------------------------------------------------
  // 4. GLOBAL SOCKET MESSAGE + STATUS LISTENERS
  // --------------------------------------------------

  useEffect(() => {
    if (!conversationsLoaded || !currentUserId) return;

    let socket: ChatSocket;

    try {
      socket = connectSocket();
    } catch (error) {
      console.error("Socket connection failed:", error);
      return;
    }

    function markActiveConversationAsRead() {
      if (!isWindowFocused()) return;

      const activeBackendId = activeBackendIdRef.current;

      if (!activeBackendId) return;

      const activeConversation = chatsRef.current.find(
        (chat) => chat.backendId === activeBackendId,
      );

      if (!activeConversation) return;

      activeConversation.messages.forEach((message) => {
        if (
          message.sender === "them" &&
          message.backendId &&
          message.status !== "read"
        ) {
          acknowledgeRead(message.backendId);
        }
      });
    }

    function handleNewMessage(backendMessage: BackendMessage) {
      const isIncoming = backendMessage.senderId !== currentUserId;

      if (isIncoming) {
        // Delivery receipt is sent regardless of the active chat.

        console.log("ACTIVE CHAT:", activeChat?.backendId);
        console.log("MESSAGE CHAT:", backendMessage.conversationId);
        console.log("WINDOW FOCUSED:", document.hasFocus());
        console.log("DOCUMENT VISIBLE:", document.visibilityState);

        acknowledgeDelivered(backendMessage._id);

        // Read receipt only for the active, focused conversation.
        if (
          backendMessage.conversationId === activeBackendIdRef.current &&
          isWindowFocused()
        ) {
          acknowledgeRead(backendMessage._id);
        }
      }

      const incomingMessage: Message = {
        id: Date.now(),
        backendId: backendMessage._id,
        clientMessageId: backendMessage.clientMessageId,
        text: backendMessage.text,
        sender: isIncoming ? "them" : "me",
        time: formatMessageTime(backendMessage.createdAt),
        status: backendMessage.status,
      };

      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (chat.backendId !== backendMessage.conversationId) {
            return chat;
          }

          const alreadyExists = chat.messages.some(
            (existingMessage) =>
              existingMessage.backendId === incomingMessage.backendId ||
              existingMessage.clientMessageId ===
                incomingMessage.clientMessageId,
          );

          if (alreadyExists) return chat;

          return {
            ...chat,
            message: incomingMessage.text,
            messages: [...chat.messages, incomingMessage],
          };
        }),
      );
    }

    function handleMessageStatus(data: {
      messageId: string;
      status: "sent" | "delivered" | "read";
    }) {
      setChats((previousChats) =>
        previousChats.map((chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.backendId === data.messageId
              ? { ...message, status: data.status }
              : message,
          ),
        })),
      );
    }

    function handleWindowFocus() {
      markActiveConversationAsRead();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        markActiveConversationAsRead();
      }
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:status", handleMessageStatus);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:status", handleMessageStatus);

      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    conversationsLoaded,
    currentUserId,
    acknowledgeDelivered,
    acknowledgeRead,
  ]);

  // --------------------------------------------------
  // 5. JOIN / LEAVE ACTIVE CONVERSATION ROOM
  // --------------------------------------------------

  useEffect(() => {
    const activeBackendId = activeChat?.backendId;

    if (!conversationsLoaded || !activeBackendId) return;

    const conversationId = activeBackendId;

    let socket: ChatSocket;

    try {
      socket = connectSocket();
    } catch (error) {
      console.error("Socket connection failed:", error);
      return;
    }

    function joinConversation() {
      socket.emit("conversation:join", { conversationId }, (response) => {
        if (!response.success) {
          console.error("Failed to join conversation:", response.message);
        }
      });
    }

    socket.on("connect", joinConversation);

    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.off("connect", joinConversation);
      socket.emit("conversation:leave", { conversationId });
    };
  }, [activeChat?.backendId, conversationsLoaded]);

  // --------------------------------------------------
  // 6. SAVE CHATS AND USER PREFERENCES
  // --------------------------------------------------

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    localStorage.setItem("favoriteChats", JSON.stringify(favoriteChats));
  }, [favoriteChats]);

  useEffect(() => {
    localStorage.setItem("mutedChats", JSON.stringify(mutedChats));
  }, [mutedChats]);

  useEffect(() => {
    const socket = connectSocket();
    const conversationId = activeChat?.backendId;

    if (!conversationId) {
      setRemoteTyping(false);
      return;
    }

    const handleRemoteTypingStart = (data: {
      conversationId: string;
      userId: string;
    }) => {
      if (data.conversationId !== conversationId) return;

      setRemoteTyping(true);

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
      }

      // Safety: stop event miss ho jaye tab bhi indicator stuck nahi rahega.
      remoteTypingTimeoutRef.current = setTimeout(() => {
        setRemoteTyping(false);
        remoteTypingTimeoutRef.current = null;
      }, 3000);
    };

    const handleRemoteTypingStop = (data: {
      conversationId: string;
      userId: string;
    }) => {
      if (data.conversationId !== conversationId) return;

      setRemoteTyping(false);

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }
    };

    socket.on("typing:start", handleRemoteTypingStart);
    socket.on("typing:stop", handleRemoteTypingStop);

    return () => {
      socket.off("typing:start", handleRemoteTypingStart);
      socket.off("typing:stop", handleRemoteTypingStop);

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }

      setRemoteTyping(false);
    };
  }, [activeChat?.backendId]);

  // --------------------------------------------------
  // 7. COMPOSER AND SETTINGS STATE
  // --------------------------------------------------

  const [message, setMessage] = useState("");

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() =>
    loadSettings(defaultSettings),
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  function updateSettings(updates: Partial<UserSettings>) {
    setSettings((previousSettings) => {
      const newSettings = {
        ...previousSettings,
        ...updates,
      };

      saveSettings(newSettings);
      return newSettings;
    });
  }

  function updateChatWallpaper(color: string) {
    setChats((previousChats) => {
      const updatedChats = previousChats.map((chat) =>
        chat.id === activeChatId ? { ...chat, wallpaper: color } : chat,
      );

      saveChatWallpapers(updatedChats);

      return updatedChats;
    });
  }

  // --------------------------------------------------
  // 8. DELETE CHAT
  // --------------------------------------------------

  function deleteChat() {
    const updatedChats = chats.filter((chat) => chat.id !== activeChatId);

    if (updatedChats.length === 0) {
      alert("You cannot delete the last remaining chat yet.");
      return;
    }

    setChats(updatedChats);

    const nextChat = updatedChats[0];

    if (nextChat) {
      setActiveChatId(nextChat.id);
      saveActiveChatId(nextChat.id);
    }
  }

  // --------------------------------------------------
  // 9. AUTO SCROLL
  // --------------------------------------------------

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [activeChatId, activeChat?.messages.length]);

  // --------------------------------------------------
  // 10. SEND MESSAGE
  // --------------------------------------------------

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleTypingStop();

    const text = message.trim();

    if (!text || !activeChat?.backendId) return;

    const targetChatId = activeChat.id;
    const targetBackendId = activeChat.backendId;
    const replyMessage = replyingTo;
    const clientMessageId = crypto.randomUUID();

    try {
      const response = await apiRequest<{
        success: boolean;
        data: {
          _id: string;
          clientMessageId: string;
          text: string;
          senderId: string;
          createdAt: string;
          status: "sent" | "delivered" | "read";
        };
      }>(
        "/messages",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: targetBackendId,
            clientMessageId,
            text,
          }),
        },
        true,
      );

      const savedMessage = response.data;

      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (chat.id !== targetChatId) return chat;

          const alreadyExists = chat.messages.some(
            (existingMessage) =>
              existingMessage.backendId === savedMessage._id ||
              existingMessage.clientMessageId === savedMessage.clientMessageId,
          );

          if (alreadyExists) return chat;

          const newMessage: Message = {
            id: Date.now(),
            backendId: savedMessage._id,
            clientMessageId: savedMessage.clientMessageId,
            text: savedMessage.text,
            sender: "me",
            time: formatMessageTime(savedMessage.createdAt),
            status: savedMessage.status,
            ...(replyMessage && {
              replyToMessageId: replyMessage.id,
            }),
          };

          return {
            ...chat,
            message: savedMessage.text,
            messages: [...chat.messages, newMessage],
          };
        }),
      );

      setMessage("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Message sending failed:", error);

      alert(error instanceof Error ? error.message : "Unable to send message.");
    }
  }

  // --------------------------------------------------
  // 11. MESSAGE ACTIONS
  // --------------------------------------------------

  function toggleStarMessage(messageId: number) {
    setChats((previousChats) =>
      previousChats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId
            ? { ...message, isStarred: !message.isStarred }
            : message,
        ),
      })),
    );
  }

  function togglePinMessage(messageId: number) {
    setChats((previousChats) =>
      previousChats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId
            ? { ...message, isPinned: !message.isPinned }
            : message,
        ),
      })),
    );
  }

  function deleteMessage(messageId: number) {
    setChats((previousChats) =>
      previousChats.map((chat) => ({
        ...chat,
        messages: chat.messages.filter((message) => message.id !== messageId),
      })),
    );
  }

  // --------------------------------------------------
  // 12. STARRED AND PINNED MESSAGES
  // --------------------------------------------------

  const starredMessages = chats.flatMap((chat) =>
    chat.messages
      .filter((message) => message.isStarred)
      .map((message) => ({
        ...message,
        chatId: chat.id,
        chatName: chat.name,
      })),
  );

  const pinnedMessages = chats.flatMap((chat) =>
    chat.messages
      .filter((message) => message.isPinned)
      .map((message) => ({
        ...message,
        chatId: chat.id,
        chatName: chat.name,
      })),
  );

  // --------------------------------------------------
  // 13. START NEW CONVERSATION
  // --------------------------------------------------

  async function handleStartConversation(recipientId: string) {
    try {
      const data = await apiRequest<{
        success: boolean;
        conversation: { _id: string };
      }>(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({ recipientId }),
        },
        true,
      );

      const response = await apiRequest<ConversationsResponse>(
        "/conversations",
        {},
        true,
      );

      const loggedInUserId = user._id ?? user.id;

      const mappedChats: Chat[] = response.conversations.map(
        (conversation, index) => {
          const otherUser = conversation.participants.find(
            (participant) => participant._id !== loggedInUserId,
          );

          const existingChat = chatsRef.current.find(
            (chat) => chat.backendId === conversation._id,
          );

          return {
            id: existingChat?.id ?? index + 1,
            backendId: conversation._id,
            name: otherUser?.name ?? "Unknown User",
            message: existingChat?.message ?? "",
            messages: existingChat?.messages ?? [],
            profilePhoto: otherUser?.profilePhoto,
            about: otherUser?.about,
            status: existingChat?.status ?? "offline",
          };
        },
      );

      setChats(mappedChats);

      const selectedChat = mappedChats.find(
        (chat) => chat.backendId === data.conversation._id,
      );

      if (selectedChat) {
        setActiveChatId(selectedChat.id);
        saveActiveChatId(selectedChat.id);
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
      throw error;
    }
  }

  // --------------------------------------------------
  // 14. UI
  // --------------------------------------------------

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[#111b21] font-sans text-[#e9edef]">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        chatSearch={chatSearch}
        favoriteChats={favoriteChats}
        mutedChats={mutedChats}
        onSearchChange={setChatSearch}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId);
          saveActiveChatId(chatId);
        }}
        onOpenSettings={() => setSettingsOpen((previous) => !previous)}
        onOpenStarredMessages={() => setShowStarredMessages(true)}
        onOpenPinnedMessages={() => setShowPinnedMessages(true)}
        onStartConversation={handleStartConversation}
      />

      {showStarredMessages && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[#111b21] text-[#e9edef]">
          <div className="flex items-center gap-4 border-b border-[#303d45] bg-[#202c33] px-5 py-4">
            <button
              type="button"
              onClick={() => setShowStarredMessages(false)}
              className="text-xl hover:text-white"
              aria-label="Back to chats"
            >
              ←
            </button>

            <h2 className="text-lg font-semibold">Starred Messages</h2>

            <span className="text-sm text-[#8696a0]">
              {starredMessages.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {starredMessages.length === 0 ? (
              <p className="mt-12 text-center text-sm text-[#8696a0]">
                No starred messages yet. Star a message to see it here.
              </p>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-3">
                {starredMessages.map((message) => (
                  <button
                    key={`${message.chatId}-${message.id}`}
                    type="button"
                    onClick={() => {
                      setActiveChatId(message.chatId);
                      saveActiveChatId(message.chatId);
                      setShowStarredMessages(false);

                      window.setTimeout(() => {
                        document
                          .getElementById(
                            `message-${message.chatId}-${message.id}`,
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }, 100);
                    }}
                    className="rounded-lg border border-[#303d45] bg-[#202c33] p-4 text-left hover:bg-[#2a3942]"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#53bdeb]">
                        {message.chatName}
                      </span>

                      <span className="shrink-0 text-xs text-yellow-300">
                        ★ {message.time}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.text}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showPinnedMessages && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[#111b21] text-[#e9edef]">
          <div className="flex items-center gap-4 border-b border-[#303d45] bg-[#202c33] px-5 py-4">
            <button
              type="button"
              onClick={() => setShowPinnedMessages(false)}
              className="text-xl hover:text-white"
              aria-label="Back to chats"
            >
              ←
            </button>

            <h2 className="text-lg font-semibold">Pinned Messages</h2>

            <span className="text-sm text-[#8696a0]">
              {pinnedMessages.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {pinnedMessages.length === 0 ? (
              <p className="mt-12 text-center text-sm text-[#8696a0]">
                No pinned messages yet. Pin a message to see it here.
              </p>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-3">
                {pinnedMessages.map((message) => (
                  <button
                    key={`${message.chatId}-${message.id}`}
                    type="button"
                    onClick={() => {
                      setActiveChatId(message.chatId);
                      saveActiveChatId(message.chatId);
                      setShowPinnedMessages(false);

                      window.setTimeout(() => {
                        document
                          .getElementById(
                            `message-${message.chatId}-${message.id}`,
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }, 150);
                    }}
                    className="rounded-lg border border-[#303d45] bg-[#202c33] p-4 text-left hover:bg-[#2a3942]"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#53bdeb]">
                        {message.chatName}
                      </span>

                      <span className="shrink-0 text-xs text-[#00a884]">
                        📌 {message.time}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.text}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active conversation */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0b141a]">
        {activeChat ? (
          <>
            <ChatHeader
              name={activeChat.name}
              status={activeChat.status ?? "offline"}
              isTyping={remoteTyping}
              chatMenuOpen={chatMenuOpen}
              onToggleMenu={() => setChatMenuOpen((previous) => !previous)}
              onSearch={() => {
                setChatMenuOpen(false);
                setMessageSearchOpen((previous) => !previous);
                setMessageSearch("");
              }}
              onMenuAction={(item) => {
                setChatMenuOpen(false);

                if (item === "Clear chat") {
                  const confirmed = window.confirm(
                    `Clear all messages in ${activeChat.name}'s chat?`,
                  );

                  if (confirmed) clearChatMessages();

                  return;
                }

                if (item === "Delete chat") {
                  const confirmed = window.confirm(
                    `Delete ${activeChat.name}'s chat and all its messages?`,
                  );

                  if (confirmed) deleteChat();

                  return;
                }

                if (item === "Contact info") {
                  setContactInfoOpen(true);
                  return;
                }

                if (item === "Select messages") {
                  clearSelection();
                  setSelectMessagesMode(true);
                  return;
                }

                if (item === "Mute notifications") {
                  setMutedChats((previous) =>
                    previous.includes(activeChat.id)
                      ? previous.filter((id) => id !== activeChat.id)
                      : [...previous, activeChat.id],
                  );
                  return;
                }

                if (item === "Add to favourites") {
                  setFavoriteChats((previous) =>
                    previous.includes(activeChat.id)
                      ? previous.filter((id) => id !== activeChat.id)
                      : [...previous, activeChat.id],
                  );
                  return;
                }

                alert(`${item} — functionality will be implemented next.`);
              }}
            />

            {selectMessagesMode && (
              <div className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[#303d45] bg-[#202c33] px-4 text-[#e9edef]">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xl hover:text-white"
                  aria-label="Cancel message selection"
                >
                  ✕
                </button>

                <span className="flex-1 text-sm">
                  {selectedMessageIds.length} selected
                </span>

                <button
                  type="button"
                  disabled={selectedMessageIds.length === 0}
                  onClick={() => {
                    setForwardTargetChatId(null);
                    setForwardModalOpen(true);
                  }}
                  className="rounded px-3 py-2 text-sm hover:bg-[#2a3942] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Forward
                </button>

                <button
                  type="button"
                  disabled={selectedMessageIds.length === 0}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete ${selectedMessageIds.length} selected message(s)?`,
                    );

                    if (confirmed) deleteSelectedMessages();
                  }}
                  className="rounded px-3 py-2 text-sm hover:bg-[#2a3942] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            )}

            {messageSearchOpen && (
              <div className="flex shrink-0 items-center gap-2 border-b border-[#303d45] bg-[#202c33] px-4 py-2">
                <input
                  type="text"
                  autoFocus
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  placeholder="Search messages in this chat..."
                  className="w-full rounded-lg bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                />

                <button
                  type="button"
                  onClick={() => {
                    setMessageSearchOpen(false);
                    setMessageSearch("");
                  }}
                  className="px-2 text-lg text-[#aebac1] hover:text-white"
                  aria-label="Close message search"
                >
                  ×
                </button>
              </div>
            )}

            <MessageList
              chatId={activeChat.id}
              messages={activeChat.messages}
              wallpaper={activeChat.wallpaper ?? settings.chatBackground}
              fontSize={settings.fontSize}
              searchQuery={messageSearch}
              messagesEndRef={messagesEndRef}
              selectedMessageIds={selectedMessageIds}
              selectMessagesMode={selectMessagesMode}
              onToggleMessage={toggleMessageSelection}
              onReplyMessage={(msg) => {
                setReplyingTo(msg);
                setSelectMessagesMode(false);
                clearSelection();
              }}
              onReactMessage={(messageId, emoji) => {
                setChats((previousChats) =>
                  previousChats.map((chat) =>
                    chat.id === activeChatId
                      ? {
                          ...chat,
                          messages: chat.messages.map((msg) =>
                            msg.id === messageId
                              ? {
                                  ...msg,
                                  reaction:
                                    msg.reaction === emoji ? undefined : emoji,
                                }
                              : msg,
                          ),
                        }
                      : chat,
                  ),
                );
              }}
              onToggleStarMessage={toggleStarMessage}
              onTogglePinMessage={togglePinMessage}
              onDeleteMessage={deleteMessage}
            />

            <MessageComposer
              message={message}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              emojiPickerOpen={emojiPickerOpen}
              onMessageChange={setMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              onToggleEmojiPicker={() =>
                setEmojiPickerOpen((previous) => !previous)
              }
              onEmojiSelect={(emoji) => {
                setMessage((previous) => previous + emoji);
                setEmojiPickerOpen(false);
              }}
              onSendMessage={sendMessage}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[#8696a0]">
            Select a conversation to start messaging
          </div>
        )}
      </main>

      {contactInfoOpen && activeChat && (
        <ContactInfoPanel
          name={activeChat.name}
          messageCount={activeChat.messages.length}
          onClose={() => setContactInfoOpen(false)}
        />
      )}

      {/* Forward Messages Modal */}
      {forwardModalOpen && activeChat && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#303d45] bg-[#202c33] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Forward messages</h2>

              <button
                type="button"
                onClick={() => setForwardModalOpen(false)}
                className="text-xl text-[#8696a0] hover:text-white"
                aria-label="Close forwarding dialog"
              >
                ×
              </button>
            </div>

            <p className="mb-3 text-sm text-[#8696a0]">
              {selectedMessageIds.length} message(s) selected. Choose a chat:
            </p>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {chats
                .filter((chat) => chat.id !== activeChatId)
                .map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setForwardTargetChatId(chat.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                      forwardTargetChatId === chat.id
                        ? "border-[#00a884] bg-[#00a884]/15"
                        : "border-[#303d45] hover:bg-[#2a3942]"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#374955] font-semibold">
                      {chat.name.charAt(0).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {chat.name}
                      </span>

                      <span className="block truncate text-xs text-[#8696a0]">
                        {chat.message || "No messages yet"}
                      </span>
                    </span>

                    <span className="text-[#00a884]">
                      {forwardTargetChatId === chat.id ? "✓" : ""}
                    </span>
                  </button>
                ))}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForwardModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-[#2a3942]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={forwardTargetChatId === null}
                onClick={() => {
                  if (forwardTargetChatId === null) return;

                  forwardSelectedMessages(forwardTargetChatId);
                  setForwardModalOpen(false);
                  setForwardTargetChatId(null);
                }}
                className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-semibold text-white hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="absolute right-4 top-16 z-50 w-72 rounded-xl border border-[#303d45] bg-[#202c33] p-4 text-[#e9edef] shadow-xl">
          <h2 className="mb-4 text-lg font-semibold">Settings</h2>

          <label className="mb-2 block text-sm">Chat background</label>

          <div className="flex flex-wrap gap-3">
            {[
              "#0b141a",
              "#202c33",
              "#1d3557",
              "#3a2d4f",
              "#234e52",
              "#5c3d2e",
            ].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateSettings({ chatBackground: color })}
                className={`h-9 w-9 rounded-full border-2 ${
                  settings.chatBackground === color
                    ? "border-[#00a884] ring-2 ring-[#00a884]/40"
                    : "border-white/30"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Choose background ${color}`}
                title={color}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-[#303d45] pt-4">
            <h3 className="mb-2 text-sm font-medium">
              Wallpaper for {activeChat?.name ?? "current chat"}
            </h3>

            <div className="flex flex-wrap gap-3">
              {[
                "#0b141a",
                "#202c33",
                "#1d3557",
                "#3a2d4f",
                "#234e52",
                "#5c3d2e",
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateChatWallpaper(color)}
                  className={`h-9 w-9 rounded-full border-2 ${
                    activeChat?.wallpaper === color
                      ? "border-[#00a884] ring-2 ring-[#00a884]/40"
                      : "border-white/30"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Set ${activeChat?.name ?? "chat"} wallpaper to ${color}`}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium">
              Message font size
            </label>

            <select
              value={settings.fontSize}
              onChange={(event) =>
                updateSettings({
                  fontSize: event.target.value as UserSettings["fontSize"],
                })
              }
              className="w-full rounded-lg border border-[#303d45] bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] outline-none focus:border-[#00a884]"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="mt-5 w-full rounded-lg bg-[#00a884] px-3 py-2 text-sm font-semibold text-white hover:bg-[#06cf9c]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
