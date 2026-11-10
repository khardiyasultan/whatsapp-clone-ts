import type { Chat, UserSettings } from "../types/chat";

export const STORAGE_KEYS = {
  chats: "whatsapp-chats",
  activeChat: "whatsapp-active-chat",
  settings: "whatsapp-settings",
  chatWallpapers: "whatsapp-chat-wallpapers",
} as const;

export function loadChatWallpapers(): Record<number, string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.chatWallpapers);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveChatWallpapers(chats: Chat[]): void {
  const wallpapers = chats.reduce<Record<number, string>>((result, chat) => {
    if (chat.wallpaper) {
      result[chat.id] = chat.wallpaper;
    }

    return result;
  }, {});

  localStorage.setItem(STORAGE_KEYS.chatWallpapers, JSON.stringify(wallpapers));
}

export function loadSettings(defaultSettings: UserSettings): UserSettings {
  const saved = localStorage.getItem(STORAGE_KEYS.settings);

  if (saved) {
    try {
      return {
        ...defaultSettings,
        ...JSON.parse(saved),
      } as UserSettings;
    } catch {
      return defaultSettings;
    }
  }

  return defaultSettings;
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function saveChats(chats: Chat[]): void {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
}

export function loadChats(initialChats: Chat[]): Chat[] {
  const savedWallpapers = loadChatWallpapers();
  const savedChats = localStorage.getItem(STORAGE_KEYS.chats);

  if (savedChats) {
    try {
      const parsedChats: Chat[] = JSON.parse(savedChats);

      return parsedChats.map((chat) => {
        const initialChat = initialChats.find(
          (initial) => initial.id === chat.id,
        );

        return {
          ...chat,
          status: initialChat?.status ?? chat.status ?? "offline",
          wallpaper: savedWallpapers[chat.id] ?? chat.wallpaper,
        };
      });
    } catch {
      // Invalid saved data: use initial chats.
    }
  }

  return initialChats.map((chat) => ({
    ...chat,
    wallpaper: savedWallpapers[chat.id] ?? chat.wallpaper,
  }));
}

export function loadActiveChatId(): number | null {
  const savedChatId = localStorage.getItem(STORAGE_KEYS.activeChat);

  if (savedChatId === null) {
    return null;
  }

  const chatId = Number(savedChatId);

  return Number.isFinite(chatId) ? chatId : null;
}

export function saveActiveChatId(chatId: number): void {
  localStorage.setItem(STORAGE_KEYS.activeChat, String(chatId));
}
