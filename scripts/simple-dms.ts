import WebSocket from "ws";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const requiredEnvVars = [
  "WHOP_API_KEY",
  "WHOP_APP_ID",
  "WHOP_ADMIN_USER_ID",
  "WHOP_COMPANY_ID",
  "TARGET_FEED_ID",
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
 * Send a message (or reply) to the target feed
 * @param message The message content
 * @param replyingToPostId Optional ID of the post being replied to
 * @param mentionIds Optional array of user IDs to mention
 */
async function sendMessage(
  message: string,
  replyingToPostId?: string,
  mentionIds: string[] = []
): Promise<void> {
  try {
    const mutation = `
      mutation processEntities($input: ProcessEntitiesInput!) {
        processEntities(input: $input) {
          entities { id entityType }
        }
      }
    `;

    const chatFeed: any = {
      id: uuidv4(),
      feedId: TARGET_FEED_ID,
      feedType: "chat_feed",
      content: message,
      gifs: [],
      attachments: [],
    };

    if (replyingToPostId) {
      chatFeed.replyingToPostId = replyingToPostId;
    }
    if (mentionIds.length > 0) {
      chatFeed.mentionedUserIds = mentionIds;
    }

    const variables = {
      input: {
        appId: process.env.WHOP_APP_ID,
        chatFeeds: [chatFeed],
      },
    };

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      { query: mutation, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "x-on-behalf-of": process.env.WHOP_ADMIN_USER_ID!,
          "x-company-id": process.env.WHOP_COMPANY_ID!,
        },
      }
    );

    if (response.data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
    }

    console.log("Message sent successfully via processEntities");
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

function connect() {
  const apiKey = process.env.WHOP_API_KEY;
  const userId = process.env.WHOP_ADMIN_USER_ID;

  ws = new WebSocket("wss://ws-prod.whop.com/ws/developer", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-on-behalf-of": userId!,
      "x-company-id": process.env.WHOP_COMPANY_ID!,
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
  console.log('Type "!new" in the chat to test the bot response');
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

    let content: string | undefined;
    let username: string;
    let originalPostId: string | undefined;

    if (message.feedEntity?.dmsPost) {
      const dmsPost = message.feedEntity.dmsPost;
      content = dmsPost.content ?? dmsPost.message;
      username = dmsPost.user.username;
      originalPostId = dmsPost.id;
      console.log(`DM from ${username}:`, content);
    } else if (
      message.type === "chat_message" ||
      message.feedEntity?.chatPost
    ) {
      if (message.type === "chat_message") {
        content = message.data.content;
        username = message.data.user.username;
        originalPostId = message.data.id;
      } else {
        const chatPost = message.feedEntity.chatPost;
        content = chatPost.content ?? chatPost.message;
        username = chatPost.user.username;
        originalPostId = chatPost.id;
      }
      console.log(`Chat from ${username}:`, content);
    }

    if (
      typeof content === "string" &&
      content.toLowerCase().includes("!new") &&
      originalPostId
    ) {
      console.log(`Detected "!new" from $, replying...`);
      await sendMessage(
        `Check out the Whop U Course! https://whop.com/whop/whop-course-mgE1ffKiZasYiF/app/?`,
        originalPostId
      );
    }
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
}

function handleClose(code: number, reason: string) {
  console.log(`❌ WebSocket connection closed: ${code} - ${reason}`);
  if (pingInterval) clearInterval(pingInterval);
  ws = null;
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
  if (pingInterval) clearInterval(pingInterval);
  if (ws) ws.close();
  process.exit(0);
});

console.log("Press Ctrl+C to exit");
