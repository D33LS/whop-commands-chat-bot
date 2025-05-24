import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { WebhookService } from "@/lib/webhooks/WebhookService";
import { getFeedPosts } from "@/lib/whopClient/chatApi";
import { formatDate } from "@/lib/utils";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface TranscriptArgs {
  messageCount: number;
}

/**
 * Parse the /transcript command
 * @param raw The raw command string
 * @returns The parsed arguments for the transcript command
 */
export function parseTranscriptCommand(raw: string): TranscriptArgs {
  let messageCount = 50;

  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const parsedCount = parseInt(parts[1], 10);
    if (!isNaN(parsedCount) && parsedCount > 0) {
      messageCount = Math.min(parsedCount, 500);
    }
  }

  return { messageCount };
}

/**
 * Execute the /transcript command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeTranscriptCommand(
  args: TranscriptArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { messageCount } = args;

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: `📑 Generating transcript of the last ${messageCount} messages...`,
    feedType: ctx.feedType,
  });

  const commandTimestamp = Date.now();
  const additionalBuffer = 10;
  const response = await getFeedPosts(
    ctx.feedId,
    ctx.feedType,
    messageCount + additionalBuffer
  );

  if (!response || !response.posts || response.posts.length === 0) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "No messages found to include in the transcript.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No messages found for transcript",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const filteredPosts = response.posts.filter((post: any) => {
    const postTimestamp =
      typeof post.createdAt === "string"
        ? parseInt(post.createdAt, 10)
        : post.createdAt;

    const isCommandMessage =
      post.content &&
      typeof post.content === "string" &&
      post.content.trim().startsWith("/transcript");

    return postTimestamp < commandTimestamp && !isCommandMessage;
  });

  const postsToInclude = filteredPosts.slice(0, messageCount);
  const filteredResponse = {
    ...response,
    posts: postsToInclude,
  };

  const transcript = formatTranscript(
    filteredResponse,
    ctx.feedId,
    ctx.feedType
  );

  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const fileName = `transcript_${ctx.feedId}_${timestamp}.txt`;

  // Option 1: Send to webhook with transcript content
  await sendTranscriptWebhook(transcript, fileName, ctx, postsToInclude.length);

  // Option 2: Generate downloadable file (requires API endpoint)
  await generateDownloadableTranscript(transcript, fileName, ctx);

  return {
    success: true,
    message: `Transcript generated with ${postsToInclude.length} messages`,
    data: {
      messageCount: postsToInclude.length,
      feedId: ctx.feedId,
      fileName,
    },
    messageSent: true,
  };
}

/**
 * Format messages into a readable transcript
 * @param response The response from the getFeedPosts API
 * @param feedId The ID of the feed
 * @param feedType The type of the feed
 * @returns A formatted transcript string
 */
function formatTranscript(
  response: any,
  feedId: string,
  feedType: string
): string {
  const { posts, users } = response;

  // Map user IDs to usernames for quick lookup
  const userMap = new Map();
  users.forEach((user: any) => {
    userMap.set(user.id, user.username || user.name || user.id);
  });

  // Sort posts by timestamp (newest to oldest)
  const sortedPosts = [...posts].sort((a, b) => {
    return parseInt(b.createdAt) - parseInt(a.createdAt);
  });

  // Build the header with feed info
  const header = [
    "=".repeat(80),
    `CHAT TRANSCRIPT - ${feedType.toUpperCase()}`,
    `Feed ID: ${feedId}`,
    `Generated: ${new Date().toISOString()}`,
    `Messages: ${posts.length}`,
    "=".repeat(80),
    "",
  ].join("\n");

  // Build the message content
  const messagesContent = sortedPosts
    .map((post: any) => {
      const username = userMap.get(post.userId) || "Unknown User";
      const timestamp = formatDate(post.createdAt);
      const content = post.content || "(No content)";
      const adminBadge = post.isPosterAdmin ? " [ADMIN]" : "";

      return `[${timestamp}] ${username}${adminBadge}: ${content}`;
    })
    .join("\n\n");

  return `${header}\n${messagesContent}\n\n${"=".repeat(80)}`;
}

/**
 * Send the transcript to a webhook
 * @param transcript The formatted transcript text
 * @param fileName The name of the transcript file
 * @param ctx The command context
 * @param messageCount The number of messages in the transcript
 */
async function sendTranscriptWebhook(
  transcript: string,
  fileName: string,
  ctx: CommandContext,
  messageCount: number
): Promise<void> {
  try {
    const webhookService = WebhookService.getInstance();

    // Create an embed for the webhook
    const embed = webhookService.createRichEmbed({
      title: "📑 Chat Transcript Generated",
      description: `A transcript has been generated for feed ID: ${ctx.feedId}`,
      color: 0x4287f5, // Blue
      fields: [
        {
          name: "Moderator",
          value: `<@${ctx.userId}>`,
          inline: true,
        },
        {
          name: "Messages",
          value: `${messageCount}`,
          inline: true,
        },
        {
          name: "Generated",
          value: new Date().toISOString(),
          inline: true,
        },
      ],
      footer: {
        text: `Whop Moderation • Transcript`,
      },
    });

    // Send preview of transcript to webhook
    const preview =
      transcript.length > 1000
        ? transcript.substring(0, 1000) +
          "...\n\n[Transcript truncated for preview]"
        : transcript;

    const content = `**Chat Transcript Requested by <@${ctx.userId}>**\n\`\`\`\n${preview}\n\`\`\``;

    // Send the webhook
    await webhookService.sendContentWithEmbeds("log", content, [embed]);
    console.log("Transcript webhook sent successfully");
  } catch (error) {
    console.error("Error sending transcript webhook:", error);
  }
}

/**
 * Generate a downloadable transcript file by calling your API endpoint
 * @param transcript The formatted transcript text
 * @param fileName The name of the transcript file
 * @param ctx The command context
 */
async function generateDownloadableTranscript(
  transcript: string,
  fileName: string,
  ctx: CommandContext
): Promise<void> {
  try {
    console.log("Starting downloadable transcript generation...");

    // Parse transcript into messages format for your API
    const lines = transcript.split("\n").filter((line) => line.includes("]:"));
    const messages = lines
      .map((line) => {
        const match = line.match(/\[(.*?)\] (.*?):(.*)$/);
        if (match) {
          return {
            user: match[2].trim(),
            content: match[3].trim(),
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`Parsed ${messages.length} messages for API`);

    // Call your transcript generation API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/transcripts/generate-transcript`;

    console.log(`Calling API at: ${apiUrl}`);
    console.log(`Sending ${messages.length} messages to API`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    console.log(`API response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log("API response data:", data);

      const downloadUrl = `${baseUrl}${data.downloadUrl}`;

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `✅ Transcript generated successfully!\n📄 Download: ${downloadUrl}\n⏰ File will be available for 24 hours.`,
        feedType: ctx.feedType,
      });

      console.log("Download URL sent to chat");
    } else {
      const errorText = await response.text();
      console.error(`API error: ${response.status} - ${errorText}`);
      throw new Error(
        `API responded with status: ${response.status} - ${errorText}`
      );
    }
  } catch (error) {
    console.error("Error generating downloadable transcript:", error);

    // Fallback: just send transcript in webhook if file generation fails
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `⚠️ Transcript generated but file download failed. Check the logs channel for the transcript content.\nError: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      feedType: ctx.feedType,
    });
  }
}

/**
 * Handle transcript command failures
 */
export async function handleTranscriptFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: TranscriptArgs
): Promise<void> {
  if (result.messageSent || result.skipWebhook) {
    return;
  }

  await ctx
    .sendMessage({
      feedId: ctx.feedId,
      message: "❌ Failed to generate transcript. Please try again later.",
      feedType: ctx.feedType,
    })
    .catch((err) =>
      console.error("Error sending transcript error message:", err)
    );

  await logInfo("Transcript Generation Failure", result.message, {
    userId: ctx.userId,
    feedId: ctx.feedId,
    feedType: ctx.feedType,
    messageCount: args.messageCount,
  }).catch((logErr) =>
    console.error("Error logging transcript failure:", logErr)
  );
}
