// scripts/simple-ping-pong.ts
import WebSocket from "ws";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const requiredEnvVars = [
  "WHOP_API_KEY",
  "ADMIN_USER_ID",
  "WHOP_COMPANY_ID",
  "CHAT_ADMIN_USER_ID",
  "WHOPU_CHAT_FEED_ID",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

const TARGET_FEED_ID = process.env.TARGET_FEED_ID!;
console.log(`Starting WebSocket listener for feed: ${TARGET_FEED_ID}`);

let ws: WebSocket | null = null;
let pingInterval: NodeJS.Timeout | null = null;

/**
 * Send a message to the target feed
 * @param message The message content
 * @returns Promise that resolves when the message is sent
 */
async function sendMessage(message: string): Promise<void> {
  try {
    const mutation = `
      mutation sendMessage($input: SendMessageInput!) {
        sendMessage(input: $input)
      }
    `;

    const variables = {
      input: {
        feedId: TARGET_FEED_ID,
        feedType: "chat_feed",
        message,
      },
    };

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: mutation,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "x-on-behalf-of": process.env.CHAT_ADMIN_USER_ID,
          "x-company-id": process.env.WHOP_COMPANY_ID,
        },
      }
    );

    if (response.data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
    }

    console.log("Message sent successfully");
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

function connect() {
  const apiKey = process.env.WHOP_API_KEY;
  const userId = process.env.ADMIN_USER_ID;

  if (!apiKey || !userId) {
    throw new Error(
      "Missing required environment variables: WHOP_API_KEY, ADMIN_USER_ID"
    );
  }

  ws = new WebSocket("wss://ws-prod.whop.com/ws/developer", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-on-behalf-of": userId,
      "x-company-id": process.env.WHOP_COMPANY_ID,
    },
  });

  ws.on("open", handleOpen);
  ws.on("message", handleMessage);
  ws.on("close", handleClose);
  ws.on("error", handleError);

  console.log("WebSocket connection initiated");
}

function handleOpen() {
  console.log("✅ WebSocket connection established");

  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "!new" }));
    }
  }, 30000);

  console.log(`Listening for messages in feed: ${TARGET_FEED_ID}`);
  console.log('Type "ping" in the chat to test the bot response');
}

async function handleMessage(data: WebSocket.Data) {
  try {
    const rawMessage = data.toString();
    const message = JSON.parse(rawMessage);

    const feedId =
      message.feedId ||
      message.feedEntity?.dmsPost?.feedId ||
      message.feedEntity?.chatPost?.feedId ||
      message.feedEntity?.id;

    if (feedId !== TARGET_FEED_ID) {
      return;
    }

    // === DM branch ===
    if (message.feedEntity?.dmsPost) {
      const dmsPost = message.feedEntity.dmsPost;

      const content = dmsPost.content ?? dmsPost.message;
      const username = dmsPost.user.username;

      console.log(`DM from ${username} in target feed:`, content);

      if (
        typeof content === "string" &&
        content.toLowerCase().includes("!new")
      ) {
        console.log(`Detected "ping" from ${username}, sending "pong"...`);
        await sendMessage(
          `Check out the Whop U Course! https://whop.com/whop/whop-course-mgE1ffKiZasYiF/app/?`
        );
      }
    }
    // === Chat branch ===
    else if (message.type === "chat_message" || message.feedEntity?.chatPost) {
      let content: string | undefined, username: string;

      if (message.type === "chat_message") {
        content = message.data.content;
        username = message.data.user.username;
      } else {
        const chatPost = message.feedEntity.chatPost;
        content = chatPost.content ?? chatPost.message;
        username = chatPost.user.username;
      }

      console.log(`Chat from ${username} in target feed:`, content);

      if (
        typeof content === "string" &&
        content.toLowerCase().includes("!new")
      ) {
        console.log(`Detected "ping" from ${username}, sending "pong"...`);
        await sendMessage(
          `Check out the Whop U Course! https://whop.com/whop/whop-course-mgE1ffKiZasYiF/app/?`
        );
      }
    }
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
}

function handleClose(code: number, reason: string) {
  console.log(`❌ WebSocket connection closed: ${code} - ${reason}`);

  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  ws = null;

  console.log("Attempting to reconnect in 5 seconds...");
  setTimeout(connect, 5000);
}

function handleError(error: Error) {
  console.error("❌ WebSocket error:", error);
}

try {
  connect();
} catch (error) {
  console.error("Failed to connect to WebSocket server:", error);
  process.exit(1);
}

process.on("SIGINT", () => {
  console.log("Disconnecting WebSocket and exiting...");

  if (pingInterval) {
    clearInterval(pingInterval);
  }

  if (ws) {
    ws.close();
  }

  process.exit(0);
});

console.log("Press Ctrl+C to exit");
