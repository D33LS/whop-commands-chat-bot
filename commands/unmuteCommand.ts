import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { unmuteUser } from "@/lib/whopClient/userApi";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { formatDate } from "@/lib/utils";
import { sendUnmuteWebhook } from "@/lib/webhooks/ModerationWebhooks";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface UnmuteArgs {
  targetUserId: string;
}

/**
 * Parse the /unmute command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the unmute command
 */
export function parseUnmuteCommand(
  raw: string,
  mentionedUserIds: string[] = []
): UnmuteArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return {
      targetUserId: "",
    };
  }

  const targetUserId = mentionedUserIds[0];

  return { targetUserId };
}

/**
 * Execute the /unmute command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeUnmuteCommand(
  args: UnmuteArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId } = args;

  if (!targetUserId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Usage: /unmute @username",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "No user mentioned",
      messageSent: true,
      skipWebhook: true,
    };
  }

  try {
    const result = await unmuteUser(targetUserId);

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `User has been unmuted.`,
      feedType: ctx.feedType,
    });

    // Continue to webhook logic after successful unmute
  } catch (error: any) {
    if (
      error.message &&
      (error.message.includes("not muted") ||
        error.message.includes("not found"))
    ) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `User is not currently muted.`,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: `User is not currently muted`,
        data: { targetUserId },
        messageSent: true,
      };
    }

    throw error;
  }

  let targetUsername = "";
  let targetName = "";
  let targetAvatar = "";
  let createdAt = "Unknown";

  try {
    const targetUser = await getUserInfo(targetUserId);
    targetUsername = targetUser.username || targetUserId;
    targetName = targetUser.name || targetUsername;
    targetAvatar = targetUser.profilePic || "";
    if (targetUser.createdAt) {
      createdAt = formatDate(targetUser.createdAt);
    }
  } catch (userError) {
    console.error("Error getting target user info:", userError);
    targetUsername = targetUserId;
  }

  let moderatorUsername = "";
  let moderatorName = "";

  try {
    const moderator = await getUserInfo(ctx.userId);
    moderatorUsername = moderator.username || ctx.userId;
    moderatorName = moderator.name || moderatorUsername;
  } catch (modError) {
    console.error("Error getting moderator info:", modError);
    moderatorUsername = ctx.userId;
  }

  try {
    await sendUnmuteWebhook(
      targetUserId,
      targetUsername,
      targetName,
      ctx.userId,
      moderatorUsername
    );
  } catch (webhookError) {
    console.error("Error sending unmute webhook:", webhookError);
  }

  return {
    success: true,
    message: `User has been unmuted`,
    data: { targetUserId },
    messageSent: true,
  };
}

/**
 * Handle webhook on mute command failure
 */
export async function handleUnmuteFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: UnmuteArgs
): Promise<void> {
  if (result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Unmuting User", result.message, {
      targetUserId: args.targetUserId,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }
}
