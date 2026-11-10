// export type Message = {
//   id: number;
//   text: string;
//   sender: "me" | "them";
//   time: string;
//   replyToMessageId?: number;
//   reaction?: string;
//   isStarred?: boolean;
//   isPinned?: boolean;
// };

export type Message = {
  id: number;
  backendId?: string;
  clientMessageId?: string;
  text: string;
  sender: "me" | "them";
  time: string;
  status?: "sent" | "delivered" | "read";
  replyToMessageId?: number;
  reaction?: string;
  isStarred?: boolean;
  isPinned?: boolean;
};

export type Chat = {
  id: number;
  name: string;
  message: string;
  messages: Message[];
  wallpaper?: string;
  status?: "online" | "offline";
  participantId?: string;

  // Backend integration fields
  backendId?: string;
  profilePhoto?: string;
  about?: string;
};

export type UserSettings = {
  theme: "light" | "dark" | "system";
  chatBackground: string;
  fontSize: "small" | "medium" | "large";
};
