
import { io } from "socket.io-client";

const token = process.env.ACCESS_TOKEN;
const conversationId = process.env.CONVERSATION_ID;

if (!token || !conversationId) {
  throw new Error(
    "Set ACCESS_TOKEN and CONVERSATION_ID before running"
  );
}

const socket = io("http://localhost:4000", {
  auth: { token }
});

// Register this listener before connecting or joining.
socket.on("message:new", (message: unknown) => {
  console.log("LIVE MESSAGE:", message);

  if (
    typeof message !== "object" ||
    message === null ||
    !("_id" in message) ||
    typeof message._id !== "string"
  ) {
    console.error("Received message has no valid string _id");
    return;
  }

  socket.timeout(5000).emit(
    "message:delivered",
    { messageId: message._id },
    (error: Error | null, response: unknown) => {
      if (error) {
        console.error("Delivery acknowledgment timed out");
        return;
      }

      console.log("DELIVERY ACK RESPONSE:", response);

      // ADD THE READ-RECEIPT CODE HERE
      socket.timeout(5000).emit(
        "message:read",
        { messageId: message._id },
        (readError: Error | null, readResponse: unknown) => {
          if (readError) {
            console.error("Read receipt acknowledgement timed out");
            return;
          }

          console.log("READ ACK RESPONSE:", readResponse);
        }
      );
    }
  );
});

socket.on("connect", () => {
  console.log("Receiver connected:", socket.id);

  socket.timeout(5000).emit(
    "conversation:join",
    { conversationId },
    async (error: Error | null, response: unknown) => {
      if (error) {
        console.error("Join acknowledgement timed out");
        socket.disconnect();
        return;
      }

      console.log("Receiver join response:", response);

      if (
        typeof response !== "object" ||
        response === null ||
        !("success" in response) ||
        response.success !== true
      ) {
        console.error("Could not join conversation");
        socket.disconnect();
        return;
      }

      try {
        const url = new URL(
          `/api/messages/${encodeURIComponent(conversationId)}`,
          "http://localhost:4000"
        );

        url.searchParams.set("limit", "20");

        const historyResponse = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const history = await historyResponse.json();

        if (!historyResponse.ok || history.success !== true) {
          console.error(
            "Failed to recover message history:",
            history
          );
          return;
        }

        console.log("RECOVERED MESSAGE HISTORY:", history.messages);
        console.log("Recovered count:", history.count);
        console.log("Has more messages:", history.hasMore);
        console.log("Next cursor:", history.nextCursor);
      } catch (error) {
        console.error("History recovery failed:", error);
      }
    }
  );
});

socket.on("connect_error", (error) => {
  console.error("Receiver connection rejected:", error.message);
});
