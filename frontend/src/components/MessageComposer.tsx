import type { FormEvent } from "react";
import type { Message } from "../types/chat";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";

type MessageComposerProps = {
  message: string;
  replyingTo: Message | null;
  onCancelReply: () => void;
  emojiPickerOpen: boolean;
  onMessageChange: (value: string) => void;
  onToggleEmojiPicker: () => void;
  onEmojiSelect: (emoji: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;

  onTypingStart: () => void;
  onTypingStop: () => void;
};

function MessageComposer({
  message,
  replyingTo,
  onCancelReply,
  emojiPickerOpen,
  onMessageChange,
  onToggleEmojiPicker,
  onEmojiSelect,
  onSendMessage,
  onTypingStart,
  onTypingStop,
}: MessageComposerProps) {
  return (
    <form
      onSubmit={onSendMessage}
      className="relative flex shrink-0 items-center gap-3 border-t border-[#26343b] bg-[#202c33] px-4 py-3 max-sm:gap-2 max-sm:px-2"
    >
      {replyingTo && (
        <div className="absolute bottom-full left-0 right-0 flex items-center gap-3 border-t border-[#303d45] bg-[#202c33] px-4 py-3">
          <div className="min-w-0 flex-1 border-l-4 border-[#00a884] pl-3">
            <p className="text-xs font-semibold text-[#00a884]">
              Replying to {replyingTo.sender === "me" ? "yourself" : "message"}
            </p>

            <p className="truncate text-sm text-[#aebac1]">{replyingTo.text}</p>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 px-2 text-xl text-[#aebac1] hover:text-white"
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Emoji"
        onClick={onToggleEmojiPicker}
        className="shrink-0 text-2xl text-[#aebac1] hover:text-white"
        title="Choose emoji"
      >
        ☺
      </button>

      {emojiPickerOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2">
          <EmojiPicker
            onEmojiClick={(emojiData: EmojiClickData) =>
              onEmojiSelect(emojiData.emoji)
            }
            height={350}
            width={300}
            theme="dark"
          />
        </div>
      )}

      <input
        value={message}
        onChange={(event) => {
          const value = event.target.value;

          console.log("INPUT CHANGED:", value);

          onMessageChange(value);

          if (value.trim()) {
            console.log("CALLING TYPING START");
            onTypingStart();
          } else {
            console.log("CALLING TYPING STOP");
            onTypingStop();
          }
        }}
        onBlur={onTypingStop}
        placeholder="Type a message"
        aria-label="Type a message"
        className="min-w-0 flex-1 rounded-lg border-none bg-[#2a3942] px-4 py-3 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0] focus:ring-1 focus:ring-[#00a884]"
      />

      <button
        type="submit"
        disabled={!message.trim()}
        className="shrink-0 rounded-lg bg-[#00a884] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-50 max-sm:px-3"
      >
        Send
      </button>
    </form>
  );
}

export default MessageComposer;
