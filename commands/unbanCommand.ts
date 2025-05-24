import { unbanUser } from "@/lib/whopClient/userApi";
import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { sendUnbanWebhook } from "@/lib/webhooks/ModerationWebhooks";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface UnbanArgs {
  targetUserId: string;
  reason?: string;
}

/**
 * Parse the /unban command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the unban command
 */
export function parseUnbanCommand(
  raw: string,
  mentionedUserIds: string[] = []
): UnbanArgs {
  if (mentionedUserIds && mentionedUserIds.length > 0) {
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

  const parts = raw.split(/\s+/);
  if (parts.length < 2) {
    return {
      targetUserId: "",
      reason: undefined,
    };
  }

  const potentialUserId = parts[1];
  if (potentialUserId.startsWith("user_")) {
    const targetUserId = potentialUserId;
    const reasonParts = parts.slice(2);
    const reason = reasonParts.length > 0 ? reasonParts.join(" ") : undefined;

    return { targetUserId, reason };
  }

  return {
    targetUserId: "",
    reason: undefined,
  };
}

/**
 * Execute the /unban command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeUnbanCommand(
  args: UnbanArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId, reason } = args;

  if (!targetUserId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Usage: /unban @username [reason] OR /unban user_id [reason]",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No user mentioned or user ID provided",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (targetUserId === ctx.userId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "You cannot unban yourself.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Self-unban attempt rejected",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const reasonText = reason ? ` (Reason: ${reason})` : "";

  try {
    const result = await unbanUser({ userId: targetUserId });

    const chatNotification = `User has been unbanned${reasonText}.`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: chatNotification,
      feedType: ctx.feedType,
    });
  } catch (error: any) {
    if (
      error.message &&
      (error.message.includes("not banned") ||
        error.message.includes("not found"))
    ) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `User is not currently banned.`,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: `User is not currently banned`,
        data: {
          targetUserId,
          reason,
        },
        messageSent: true,
      };
    }

    throw error;
  }

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

    await sendUnbanWebhook(
      targetUserId,
      targetUsername,
      ctx.userId,
      moderatorUsername,
      reason,
      targetName
    );
  } catch (webhookError) {
    console.error("Error sending unban webhook:", webhookError);
  }

  return {
    success: true,
    message: `User has been unbanned${reasonText}`,
    data: {
      targetUserId,
      reason,
    },
    messageSent: true,
  };
}

/**
 * Handle webhook on unban command failure
 */
export async function handleUnbanFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: UnbanArgs
): Promise<void> {
  if (result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Unbanning User", result.message, {
      targetUserId: args.targetUserId,
      reason: args.reason,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }
}
