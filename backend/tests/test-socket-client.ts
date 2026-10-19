
import { io } from "socket.io-client";

const token = process.env.ACCESS_TOKEN;
const conversationId = process.env.CONVERSATION_ID;
const messageText =
  process.env.MESSAGE_TEXT || "Testing duplicate protection";

if (!token || !conversationId) {
  throw new Error(
    "Set ACCESS_TOKEN and CONVERSATION_ID before running"
  );
}

const socket = io("http://localhost:4000", {
  auth: { token }
});
// Listen for delivery/read status updates.
socket.on("message:status", (data) => {
  console.log("MESSAGE STATUS UPDATE:", data);
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.on("message:new", (message) => {
    console.log("Received message:new:", message);
  });

  socket.timeout(5000).emit(
    "conversation:join",
    { conversationId },
    (joinError: Error | null, joinResponse: unknown) => {
      if (joinError) {
        console.error("Join acknowledgement timed out");
        socket.disconnect();
        return;
      }

      console.log("Join response:", joinResponse);

      if (
        typeof joinResponse !== "object" ||
        joinResponse === null ||
        !("success" in joinResponse) ||
        joinResponse.success !== true
      ) {
        console.error("Could not join conversation");
        socket.disconnect();
        return;
      }

      // Generate one ID and reuse it for both attempts.
      const payload = {
        conversationId,
        clientMessageId: `retry-test-${Date.now()}`,
        text: messageText
      };

      console.log("Testing clientMessageId:", payload.clientMessageId);

      // First attempt
      socket.timeout(5000).emit(
        "message:send",
        payload,
       (firstError: Error | null, firstResponse: unknown) => {
          if (firstError) {
            console.error("First send acknowledgement timed out");
            socket.disconnect();
            return;
          }

          console.log("First response:", firstResponse);

          // Retry the exact same payload with the same ID.
          socket.timeout(5000).emit(
            "message:send",
            payload,
            (retryError: Error | null, retryResponse: unknown) => {
              if (retryError) {
                console.error("Retry acknowledgement timed out");
              } else {
                console.log("Retry response:", retryResponse);
              }

             // socket.disconnect();
            }
          );
        }
      );
    }
  );
});

socket.on("connect_error", (error) => {
  console.error("Connection rejected:", error.message);
});
