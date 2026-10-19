const onlineUsers = new Map<string, Set<string>>();

export function addOnlineUser(
  userId: string,
  socketId: string
): void {
  let sockets = onlineUsers.get(userId);

  if (!sockets) {
    sockets = new Set<string>();
    onlineUsers.set(userId, sockets);
  }

  sockets.add(socketId);
}

export function removeOnlineSocket(
  userId: string,
  socketId: string
): void {
  const sockets = onlineUsers.get(userId);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}