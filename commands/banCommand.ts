import { banUser } from "@/lib/whopClient/userApi";
import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { sendBanWebhook } from "@/lib/webhooks/ModerationWebhooks";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface BanArgs {
  targetUserId: string;
  reason?: string;
}

/**
 * Parse the /ban command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the ban command
 */
export function parseBanCommand(
  raw: string,
  mentionedUserIds: string[] = []
): BanArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return {
      targetUserId: "",
      reason: undefined,
    };
  }

  const targetUserId = mentionedUserIds[0];

  const usernameMatch = raw.match(/@\w+/);
  let reason: string | undefined;

  if (usernameMatch) {
    const afterUsername = raw.substring(
      raw.indexOf(usernameMatch[0]) + usernameMatch[0].length
    );
    const reasonText = afterUsername.trim();
    if (reasonText && reasonText !== ",") {
      reason = reasonText;
    }
  }

  return { targetUserId, reason };
}

/**
 * Execute the /ban command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeBanCommand(
  args: BanArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId, reason } = args;

  if (!targetUserId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Usage: /ban @username [reason]",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No user mentioned",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (targetUserId === ctx.userId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "You cannot ban yourself.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Self-ban attempt rejected",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const reasonText = reason ? ` (Reason: ${reason})` : "";
  const result = await banUser({ userId: targetUserId });

  if (
    result &&
    typeof result === "string" &&
    result.includes("already banned")
  ) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `User is already banned.`,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: `User is already banned`,
      data: {
        targetUserId,
        reason,
      },
      messageSent: true,
      skipWebhook: true,
    };
  }

  const chatNotification = `User has been banned${reasonText}.`;
  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: chatNotification,
    feedType: ctx.feedType,
  });

  try {
    let targetUsername = "";
    let targetName = "";
    let createdAt = "Unknown";

    try {
      const targetUser = await getUserInfo(targetUserId);
      targetUsername = targetUser.username || targetUserId;
      targetName = targetUser.name || targetUsername;
      createdAt = targetUser.createdAt;
    } catch (userError) {
      console.error("Error getting target user info:", userError);
      targetUsername = targetUserId;
    }

    let moderatorUsername = "";

    try {
      const moderator = await getUserInfo(ctx.userId);
      moderatorUsername = moderator.username || ctx.userId;
    } catch (modError) {
      console.error("Error getting moderator info:", modError);
      moderatorUsername = ctx.userId;
    }

    await sendBanWebhook(
      targetUserId,
      targetUsername,
      ctx.userId,
      moderatorUsername,
      reason,
      createdAt
    );
  } catch (webhookError) {
    console.error("Error sending ban webhook:", webhookError);
  }

  return {
    success: true,
    message: `User has been banned${reasonText}`,
    data: {
      targetUserId,
      reason,
    },
    messageSent: true,
  };
}

/**
 * Handle webhook on ban command failure
 */
export async function handleBanFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: BanArgs
): Promise<void> {
  if (result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Banning User", result.message, {
      targetUserId: args.targetUserId,
      reason: args.reason,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }
}
