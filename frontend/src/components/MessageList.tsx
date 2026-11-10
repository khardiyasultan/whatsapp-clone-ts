import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { useRef, useState, type RefObject } from "react";
import type { Message } from "../types/chat";

type MessageListProps = {
  chatId: number;
  messages: Message[];
  wallpaper: string;
  fontSize: "small" | "medium" | "large";
  searchQuery: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  selectedMessageIds: number[];
  selectMessagesMode: boolean;
  onToggleMessage: (messageId: number) => void;
  onReplyMessage: (message: Message) => void;
  onReactMessage: (messageId: number, emoji: string) => void;
  onToggleStarMessage: (messageId: number) => void;
  onTogglePinMessage: (messageId: number) => void;
  onDeleteMessage: (messageId: number) => void;
};

const quickReactions = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

function MessageList({
  chatId,
  messages,
  wallpaper,
  fontSize,
  searchQuery,
  messagesEndRef,
  selectedMessageIds,
  selectMessagesMode,
  onToggleMessage,
  onReplyMessage,
  onReactMessage,
  onToggleStarMessage,
  onTogglePinMessage,
  onDeleteMessage,
}: MessageListProps) {
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  function closeMenu() {
    setMenuMessage(null);
    setShowEmojiPicker(false);
  }

  function openMenu(message: Message, x: number, y: number) {
    const menuWidth = 220;
    const menuHeight = 360;

    setMenuPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });

    setMenuMessage(message);
    setShowEmojiPicker(false);
  }

  function startLongPress(message: Message, x: number, y: number) {
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      openMenu(message, x, y);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      closeMenu();
    } catch {
      window.prompt("Copy this message:", message.text);
    }
  }

  function selectMessage(message: Message) {
    if (!selectedMessageIds.includes(message.id)) {
      onToggleMessage(message.id);
    }
    closeMenu();
  }

  function chooseReaction(emoji: string) {
    if (!menuMessage) return;

    onReactMessage(menuMessage.id, emoji);
    closeMenu();
  }

  return (
    <section
      onClick={() => {
        if (menuMessage) closeMenu();
      }}
      className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-[5%] py-5 max-sm:px-3"
      style={{ backgroundColor: wallpaper }}
    >
      {messages.some((message) => message.isPinned) && (
        <div className="sticky top-0 z-10 rounded-lg border border-[#37454d] bg-[#202c33] px-3 py-2 text-sm text-[#e9edef] shadow-md">
          <div className="mb-1 text-xs text-[#53bdeb]">📌 Pinned message</div>

          {messages
            .filter((message) => message.isPinned)
            .map((message) => (
              <button
                key={message.id}
                type="button"
                className="block w-full truncate text-left hover:underline"
                onClick={() => {
                  document
                    .getElementById(`message-${chatId}-${message.id}`)
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                }}
              >
                {message.text}
              </button>
            ))}
        </div>
      )}
      {messages
        .filter((msg) =>
          msg.text.toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
        .map((msg) => (
          <div
            key={`${chatId}-${msg.id}`}
            id={`message-${chatId}-${msg.id}`}
            onClick={(event) => {
              event.stopPropagation();

              if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
              }

              if (selectMessagesMode) {
                onToggleMessage(msg.id);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu(msg, event.clientX, event.clientY);
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (touch) {
                startLongPress(msg, touch.clientX, touch.clientY);
              }
            }}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            aria-pressed={selectedMessageIds.includes(msg.id)}
            className={`relative flex max-w-[80%] cursor-pointer flex-col rounded-lg border px-2.5 py-1.5 shadow-sm transition-colors max-sm:max-w-[92%] ${
              selectedMessageIds.includes(msg.id)
                ? "self-end border-[#53bdeb] bg-[#075e54] ring-2 ring-[#53bdeb]/40"
                : msg.sender === "me"
                  ? "self-end rounded-tr-sm border-transparent bg-[#005c4b] text-[#e9edef]"
                  : "self-start rounded-tl-sm border-transparent bg-[#202c33] text-[#e9edef]"
            }`}
          >
            <span
              className="whitespace-pre-wrap break-words"
              style={{
                fontSize:
                  fontSize === "small"
                    ? "12px"
                    : fontSize === "large"
                      ? "18px"
                      : "14px",
                lineHeight:
                  fontSize === "small"
                    ? "17px"
                    : fontSize === "large"
                      ? "24px"
                      : "19px",
              }}
            >
              {msg.text}
            </span>

            <span className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[10px] leading-3 text-[#aebac1]">
              {msg.time}

              {msg.sender === "me" && (
                <span
                  className={`font-bold ${
                    msg.status === "read" ? "text-[#53bdeb]" : "text-[#8696a0]"
                  }`}
                  title={
                    msg.status === "read"
                      ? "Read"
                      : msg.status === "delivered"
                        ? "Delivered"
                        : "Sent"
                  }
                >
                  {msg.status === "delivered" || msg.status === "read"
                    ? "✓✓"
                    : "✓"}
                </span>
              )}
            </span>

            {msg.reaction && (
              <span className="absolute -bottom-3 right-2 rounded-full border border-[#37454d] bg-[#202c33] px-1.5 py-0.5 text-sm shadow">
                {msg.reaction}
              </span>
            )}

            {msg.isStarred && (
              <span
                className="absolute bottom-1 left-2 text-xs text-yellow-300"
                title="Starred message"
              >
                ★
              </span>
            )}
          </div>
        ))}

      <div ref={messagesEndRef} />

      {menuMessage && (
        <>
          <button
            type="button"
            aria-label="Close message menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={closeMenu}
          />

          <div
            className="fixed z-50 w-[220px] max-w-[calc(100vw-16px)] rounded-xl border border-[#303d45] bg-[#202020] p-1.5 text-[#e9edef] shadow-2xl"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-around rounded-lg bg-[#303030] px-1 py-2">
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => chooseReaction(emoji)}
                  className="rounded-full p-1 text-xl transition-transform hover:scale-125 hover:bg-white/10"
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((previous) => !previous)}
                className="rounded-full px-1.5 py-1 text-lg hover:bg-white/10"
                aria-label="More emojis"
              >
                +
              </button>
            </div>

            {showEmojiPicker && (
              <div
                className="fixed z-[60]"
                style={{
                  left: Math.max(
                    8,
                    Math.min(menuPosition.x, window.innerWidth - 308),
                  ),
                  top:
                    menuPosition.y + 55 + 350 <= window.innerHeight
                      ? menuPosition.y + 55
                      : Math.max(8, menuPosition.y - 358),
                }}
              >
                <EmojiPicker
                  onEmojiClick={(emojiData: EmojiClickData) => {
                    chooseReaction(emojiData.emoji);
                  }}
                  height={350}
                  width={300}
                  theme="dark"
                />
              </div>
            )}

            {[
              {
                label: "Reply",
                icon: "↶",
                action: () => {
                  onReplyMessage(menuMessage);
                  closeMenu();
                },
              },
              {
                label: "Copy",
                icon: "▢",
                action: () => void copyMessage(menuMessage),
              },
              {
                label: "Forward",
                icon: "↗",
                action: () => {
                  closeMenu();
                  window.alert("Forward will be connected next.");
                },
              },
              {
                label: menuMessage.isPinned ? "Unpin" : "Pin",
                icon: "⌖",
                action: () => {
                  onTogglePinMessage(menuMessage.id);
                  closeMenu();
                },
              },
              {
                label: menuMessage.isStarred ? "Unstar" : "Star",
                icon: menuMessage.isStarred ? "★" : "☆",
                action: () => {
                  onToggleStarMessage(menuMessage.id);
                  closeMenu();
                },
              },
              {
                label: "Select",
                icon: "☑",
                action: () => selectMessage(menuMessage),
              },
              {
                label: "Delete",
                icon: "▤",
                action: () => {
                  if (window.confirm("Delete this message?")) {
                    onDeleteMessage(menuMessage.id);
                  }
                  closeMenu();
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/10 ${
                  item.label === "Delete" ? "text-red-300" : ""
                }`}
              >
                <span className="w-5 text-center text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default MessageList;
