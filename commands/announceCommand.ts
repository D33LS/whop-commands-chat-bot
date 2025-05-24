import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";

interface AnnounceArgs {
  message: string;
  isHighlighted: boolean;
}

/**
 * Parse the /announce command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the announce command
 */
export function parseAnnounceCommand(
  raw: string,
  mentionedUserIds: string[] = []
): AnnounceArgs {
  let msg = raw.match(/"([^"]+)"/)?.[1];
  const isHighlighted = raw.includes("highlight");

  if (!msg) {
    const parts = raw.split(/\s+/);
    if (parts.length > 1) {
      msg = parts.slice(1).join(" ");
    }
  }

  return {
    message: msg || "",
    isHighlighted,
  };
}

/**
 * Execute the /announce command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeAnnounceCommand(
  { message, isHighlighted }: AnnounceArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  if (!message) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: 'Usage: /announce "message" [highlight]',
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Missing announcement message",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (ctx.feedType !== "livestream_feed") {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "The /announce command can only be used in livestream feeds.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "The /announce command can only be used in livestream feeds.",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const formatted = isHighlighted
    ? `📢 **ANNOUNCEMENT** 📢\n\n${message}`
    : `📢 Announcement: ${message}`;

  const announcementFeedId = process.env.WHOP_ANNOUNCEMENT_FEED_ID as string;

  if (!announcementFeedId) {
    throw new Error(
      "WHOP_ANNOUNCEMENT_FEED_ID environment variable is not set"
    );
  }

  await ctx.sendMessage({
    feedId: announcementFeedId,
    message: formatted,
    feedType: "chat_feed",
  });

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: "Announcement sent successfully.",
    feedType: ctx.feedType,
  });

  return {
    success: true,
    message: "Announcement sent.",
    messageSent: true,
  };
}
