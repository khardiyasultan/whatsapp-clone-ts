import { useState } from "react";
import type { Chat } from "../types/chat";

export function useChatMessages(
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  activeChatId: number | null,
) {
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [selectMessagesMode, setSelectMessagesMode] = useState(false);

  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessageIds((previousIds) =>
      previousIds.includes(messageId)
        ? previousIds.filter((id) => id !== messageId)
        : [...previousIds, messageId],
    );
  };

  const clearSelection = () => {
    setSelectedMessageIds([]);
    setSelectMessagesMode(false);
  };

  const deleteSelectedMessages = () => {
    if (selectedMessageIds.length === 0) return;

    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: chat.messages.filter(
                (msg) => !selectedMessageIds.includes(msg.id),
              ),
            }
          : chat,
      ),
    );

    clearSelection();
  };

  const clearChatMessages = () => {
    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, message: "", messages: [] }
          : chat,
      ),
    );
  };

  const forwardSelectedMessages = (destinationChatId: number) => {
    if (selectedMessageIds.length === 0) return;

    const activeChat = chats.find((chat) => chat.id === activeChatId);
    const destinationChat = chats.find((chat) => chat.id === destinationChatId);

    if (!activeChat || !destinationChat) return;

    if (destinationChat.id === activeChatId) {
      alert("Please choose a different chat.");
      return;
    }

    const selectedMessages = activeChat.messages.filter((msg) =>
      selectedMessageIds.includes(msg.id),
    );

    if (selectedMessages.length === 0) return;

    const now = Date.now();

    const forwardedMessages = selectedMessages.map((msg, index) => ({
      ...msg,
      id: now + index,
      sender: "me" as const,
      text: `Forwarded:\n${msg.text}`,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isStarred: false,
      isPinned: false,
      reaction: undefined,
      replyToMessageId: undefined,
    }));

    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === destinationChatId
          ? {
              ...chat,
              messages: [...chat.messages, ...forwardedMessages],
              message:
                forwardedMessages[forwardedMessages.length - 1]?.text ??
                chat.message,
            }
          : chat,
      ),
    );

    clearSelection();
  };

  return {
    selectedMessageIds,
    selectMessagesMode,
    setSelectMessagesMode,
    toggleMessageSelection,
    deleteSelectedMessages,
    clearSelection,
    clearChatMessages,
    forwardSelectedMessages,
  };
}
