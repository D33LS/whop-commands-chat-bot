import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import {
  getFeedPosts,
  getChatFeedExperienceId,
  purgeMessages,
} from "@/lib/whopClient/chatApi";
import { getExperienceDetails } from "@/lib/whopClient/experienceApi";
import { FeedTypes } from "@/lib/whopClient/graphql/types";

interface PurgeArgs {
  messageCount: number;
}

/**
 * Parse the /purge command
 * @param raw The raw command string
 * @returns The parsed arguments for the purge command
 */
export function parsePurgeCommand(raw: string): PurgeArgs {
  let messageCount = 10;

  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const parsedCount = parseInt(parts[1], 10);
    if (!isNaN(parsedCount) && parsedCount > 0) {
      messageCount = Math.min(parsedCount, 100);
    }
  }

  return { messageCount };
}

/**
 * Execute the /purge command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executePurgeCommand(
  args: PurgeArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { messageCount } = args;

  if (!messageCount || messageCount <= 0) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "❓ How many messages should I delete? (e.g., `/purge 10`)",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Message count must be > 0",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const experienceId = await getChatFeedExperienceId(ctx.feedId);

  if (!experienceId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `❌ Failed to get experience ID for this feed.`,
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Could not retrieve experienceId",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const experienceDetails = await getExperienceDetails(experienceId);

  if (!experienceDetails || !experienceDetails.app) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `❌ Failed to get the app ID necessary to delete messages.`,
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Could not retrieve appId",
      messageSent: true,
      skipWebhook: true,
    };
  }

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
      message: `🚫 No messages found to delete.`,
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No messages found for purge",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const filteredPosts = response.posts.filter((post: any) => {
    const postTimestamp =
      typeof post.createdAt === "string"
        ? parseInt(post.createdAt, 10)
        : post.createdAt;

    return postTimestamp < commandTimestamp;
  });

  const postsToDelete = filteredPosts.slice(0, messageCount);

  if (postsToDelete.length === 0) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "🚫 No eligible messages found to delete.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No eligible messages for delete",
      messageSent: true,
      skipWebhook: true,
    };
  }

  try {
    const messageIds = Array.isArray(postsToDelete)
      ? postsToDelete.map((post: any) => post.id).filter(Boolean)
      : [];

    if (messageIds.length === 0) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `⚠️ Could not extract valid message IDs to delete.`,
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "No valid message IDs to delete",
        messageSent: true,
        skipWebhook: true,
      };
    }

    await purgeMessages(
      messageIds,
      ctx.feedId,
      ctx.feedType as FeedTypes,
      experienceDetails.app.id
    );

    // don't think we need a confirm
    // await ctx.sendMessage({
    //   feedId: ctx.feedId,
    //   message: `✅ Successfully deleted ${messageIds.length} messages.`,
    //   feedType: ctx.feedType,
    // });

    return {
      success: true,
      message: `Deleted ${messageIds.length} messages`,
      data: {
        messageCount: messageIds.length,
        feedId: ctx.feedId,
      },
      messageSent: true,
    };
  } catch (error) {
    console.error("Error deleting messages:", error);

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `❌ Failed to delete messages: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      feedType: ctx.feedType,
    });

    return {
      success: false,
      message: `Failed to delete messages: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      messageSent: true,
    };
  }
}
