import { useState } from "react";
import type { Chat } from "../types/chat";
import { apiRequest } from "../utils/api";

type ChatSidebarProps = {
  chats: Chat[];
  activeChatId: number | null;
  chatSearch: string;
  favoriteChats: number[];
  mutedChats: number[];
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: number) => void;
  onOpenSettings: () => void;
  onOpenStarredMessages: () => void;
  onOpenPinnedMessages: () => void;
  onStartConversation: (userId: string) => Promise<void>;
};

type SearchUser = {
  _id: string;
  name: string;
  profilePhoto?: string;
  about?: string;
};

type SearchUsersResponse = {
  success: boolean;
  count: number;
  users: SearchUser[];
};

function ChatSidebar({
  chats,
  activeChatId,
  chatSearch,
  favoriteChats,
  mutedChats,
  onSearchChange,
  onSelectChat,
  onOpenSettings,
  onOpenStarredMessages,
  onOpenPinnedMessages,
  onStartConversation,
}: ChatSidebarProps) {
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  async function handleUserSearch() {
    const query = userSearch.trim();

    if (query.length < 2) {
      setSearchError("Enter at least 2 characters.");
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setSearchError("");

      const data = await apiRequest<SearchUsersResponse>(
        `/users/search?q=${encodeURIComponent(query)}`,
        {},
        true,
      );

      setSearchResults(data.users);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Unable to search users.",
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-[#303d45] bg-[#111b21] max-sm:w-[105px]">
      <div className="flex h-[70px] shrink-0 items-center justify-between bg-[#202c33] px-5 max-sm:justify-center max-sm:px-2">
        <h1 className="text-xl font-semibold text-[#e9edef] max-sm:text-sm">
          WhatsApp
        </h1>

        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg px-3 py-2 text-xl text-[#aebac1] hover:bg-[#2a3942]"
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      <div className="shrink-0 border-b border-[#26343b] bg-[#111b21] p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#202c33] px-3">
          <span className="text-lg text-[#8696a0]" aria-hidden="true">
            ⌕
          </span>

          <input
            type="text"
            value={chatSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats..."
            aria-label="Search chats"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
          />

          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            className="mt-3 w-full rounded-lg bg-[#00a884] px-3 py-2 text-sm font-medium text-white hover:bg-[#06cf9c]"
          >
            + New Chat
          </button>

          {chatSearch && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="text-lg text-[#8696a0] hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-[#26343b] p-3 max-sm:flex-col">
        <button
          type="button"
          onClick={onOpenStarredMessages}
          className="flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-left text-sm text-[#e9edef] hover:bg-[#2a3942]"
        >
          ★ Starred Messages
        </button>

        <button
          type="button"
          onClick={onOpenPinnedMessages}
          className="flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-left text-sm text-[#e9edef] hover:bg-[#2a3942]"
        >
          📌 Pinned Messages
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {[...chats]
          .filter((chat) =>
            chat.name.toLowerCase().includes(chatSearch.toLowerCase()),
          )
          .sort(
            (a, b) =>
              Number(favoriteChats.includes(b.id)) -
              Number(favoriteChats.includes(a.id)),
          )
          .map((chat) => (
            <button
              type="button"
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`flex w-full items-center gap-3 border-b border-[#26343b] px-4 py-3.5 text-left transition-colors max-sm:flex-col max-sm:gap-1 max-sm:px-1 ${
                activeChatId === chat.id
                  ? "bg-[#2a3942]"
                  : "bg-[#111b21] hover:bg-[#202c33]"
              }`}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#6a8f85] text-lg font-semibold text-white">
                {chat.name.charAt(0)}
              </div>

              <div className="min-w-0 flex-1 max-sm:w-full max-sm:text-center">
                <div className="flex min-w-0 items-center justify-between gap-2 max-sm:justify-center">
                  <h2 className="truncate text-base font-medium text-[#e9edef] max-sm:text-xs">
                    {chat.name}
                  </h2>

                  <span className="flex shrink-0 items-center gap-1 text-xs text-[#8696a0]">
                    {favoriteChats.includes(chat.id) && (
                      <span title="Favourite" aria-label="Favourite">
                        ★
                      </span>
                    )}

                    {mutedChats.includes(chat.id) && (
                      <span title="Muted" aria-label="Muted">
                        🔕
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 max-sm:justify-center">
                  <p
                    className={`truncate text-xs ${
                      chat.status === "online"
                        ? "text-[#00a884]"
                        : "text-[#8696a0]"
                    }`}
                  >
                    {chat.status === "online" ? "online" : "offline"}
                  </p>

                  <p className="truncate text-sm text-[#8696a0] max-sm:hidden">
                    {chat.message}
                  </p>
                </div>
              </div>
            </button>
          ))}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#202c33] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New Chat</h2>

              <button
                type="button"
                onClick={() => {
                  setShowNewChat(false);
                  setUserSearch("");
                  setSearchResults([]);
                  setSearchError("");
                }}
                className="text-2xl text-[#8696a0]"
              >
                ×
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleUserSearch();
                }}
                placeholder="Search by name or email..."
                className="min-w-0 flex-1 rounded-lg bg-[#111b21] px-3 py-2 text-sm text-white outline-none"
              />

              <button
                type="button"
                disabled={searching}
                onClick={() => void handleUserSearch()}
                className="rounded-lg bg-[#00a884] px-4 py-2 text-white disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchError && (
              <p className="mt-3 text-sm text-red-400">{searchError}</p>
            )}

            <div className="mt-4 max-h-72 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result._id}
                  type="button"
                  onClick={async () => {
                    try {
                      await onStartConversation(result._id);

                      setShowNewChat(false);
                      setUserSearch("");
                      setSearchResults([]);
                      setSearchError("");
                    } catch (error) {
                      setSearchError(
                        error instanceof Error
                          ? error.message
                          : "Unable to start conversation.",
                      );
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#2a3942]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6a8f85] font-semibold text-white">
                    {result.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white">
                      {result.name}
                    </p>
                    <p className="text-xs text-[#8696a0]">
                      {result.about || "Available"}
                    </p>
                  </div>
                </button>
              ))}

              {!searching &&
                userSearch.trim().length >= 2 &&
                searchResults.length === 0 &&
                !searchError && (
                  <p className="py-5 text-center text-sm text-[#8696a0]">
                    No users found.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default ChatSidebar;
