import dotenv from "dotenv";
import { ChatWsListener, ChatEventType } from "../lib/websocket/ChatWSListener";

dotenv.config();

const requiredVars = ["WHOP_API_KEY", "WHOP_AGENT_USER_ID", "WHOP_COMPANY_ID"];

const missingVars = requiredVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`Missing environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

console.log("🚀 Starting Chat System");

const wsListener = ChatWsListener.getInstance();

wsListener.on(ChatEventType.CONNECTION_OPENED, () => {
  console.log("✅ WebSocket connection established");
  console.log("👂 Listening for chat messages and commands");
  console.log("💬 Go to your Whop chat and type /help to test commands");
});

wsListener.on(ChatEventType.CONNECTION_CLOSED, (data) => {
  console.log(`❌ WebSocket connection closed: ${data.code} - ${data.reason}`);
});

wsListener.on(ChatEventType.CONNECTION_ERROR, (error) => {
  console.error("❌ WebSocket error:", error);
});

wsListener.on(ChatEventType.MESSAGE_RECEIVED, (message) => {
  console.log(`📝 Message from ${message.username}: ${message.content}`);
});

wsListener.on(ChatEventType.COMMAND_RECEIVED, (message) => {
  console.log(`🔍 Command detected: ${message.content}`);
});

wsListener.on(ChatEventType.COMMAND_PROCESSED, (data) => {
  const { message, result } = data;
  console.log(`✅ Command processed: ${message.content}`);
  console.log(
    `Result: ${result.success ? "Success" : "Failed"} - ${result.message}`
  );
});

wsListener.on(ChatEventType.FIRST_TIME_POSTER, (message) => {
  console.log(`🎉 First-time poster: ${message.username}`);
});

try {
  wsListener.connect();
  console.log("🔄 Connecting to WebSocket server...");

  console.log("\n📋 Your system is now running!");
  console.log("- Test slash commands by typing /help in any chat");
  console.log("- First-time posters will receive a welcome message");
  console.log("- All commands defined in CommandHandler are active");
} catch (error) {
  console.error("❌ Failed to start the system:", error);
  process.exit(1);
}

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down chat system...");
  wsListener.disconnect();
  process.exit(0);
});

console.log("\n👋 Press Ctrl+C to exit");
