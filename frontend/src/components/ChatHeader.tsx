type ChatHeaderProps = {
  name: string;
  chatMenuOpen: boolean;
  isTyping: boolean;
  status: "online" | "offline";
  onToggleMenu: () => void;
  onSearch: () => void;
  onMenuAction: (item: string) => void;
};

function ChatHeader({
  name,
  status,
  chatMenuOpen,
  isTyping,
  onToggleMenu,
  onSearch,
  onMenuAction,
}: ChatHeaderProps) {
  const menuItems = [
    "Contact info",
    "Search",
    "Select messages",
    "Mute notifications",
    "Disappearing messages",
    "Chat theme",
    "Add to favourites",
    "Export chat",
    "Clear chat",
    "Delete chat",
  ];

  return (
    <header className="flex h-[70px] shrink-0 items-center gap-3 border-b border-[#303d45] bg-[#202c33] px-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#6a8f85] font-semibold text-white">
        {name.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium text-[#e9edef]">{name}</h2>

        <p
          className={`mt-0.5 text-xs ${
            isTyping ? "text-[#00a884]" : "text-[#8696a0]"
          }`}
        >
          {isTyping ? "typing..." : status}
        </p>
      </div>

      <button
        type="button"
        aria-label="Search conversation"
        onClick={onSearch}
        className="px-2 text-xl text-[#aebac1] hover:text-white"
      >
        ⌕
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label="More options"
          aria-expanded={chatMenuOpen}
          onClick={onToggleMenu}
          className="px-2 text-xl text-[#aebac1] hover:text-white"
        >
          ⋮
        </button>

        {chatMenuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-[#303d45] bg-[#202c33] py-2 shadow-xl"
            role="menu"
          >
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                role="menuitem"
                onClick={() => onMenuAction(item)}
                className="block w-full px-4 py-2.5 text-left text-sm text-[#e9edef] transition-colors hover:bg-[#2a3942]"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export default ChatHeader;
