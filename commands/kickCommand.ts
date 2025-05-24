import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { kickUser } from "@/lib/whopClient/userApi";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { logInfo } from "@/lib/webhooks/LogWebhooks";
import { sendKickWebhook } from "@/lib/webhooks/ModerationWebhooks";

//don't see kick on dash atm, and script broken so assuming removed

interface KickArgs {
  targetUserId: string;
  reason?: string;
}

/**
 * Parse the /kick command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the kick command
 */
export function parseKickCommand(
  raw: string,
  mentionedUserIds: string[] = []
): KickArgs {
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
 * Execute the /kick command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeKickCommand(
  args: KickArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId, reason } = args;

  if (!targetUserId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Usage: /kick @username [reason]",
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
      message: "You cannot kick yourself.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Self-kick attempt rejected",
      messageSent: true,
      skipWebhook: true,
    };
  }

  try {
    const reasonText = reason ? ` (Reason: ${reason})` : "";
    const result = await kickUser({ id: targetUserId });

    if (
      result &&
      typeof result === "string" &&
      result.includes("already kicked")
    ) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `User has already been kicked.`,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: `User has already been kicked`,
        data: {
          targetUserId,
          reason,
        },
        messageSent: true,
        skipWebhook: true,
      };
    }

    const chatNotification = `User has been kicked${reasonText}.`;
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

      await sendKickWebhook(
        targetUserId,
        targetUsername,
        ctx.userId,
        moderatorUsername,
        reason,
        targetName,
        createdAt
      );
    } catch (webhookError) {
      console.error("Error sending kick webhook:", webhookError);
    }

    return {
      success: true,
      message: `User has been kicked${reasonText}`,
      data: {
        targetUserId,
        reason,
      },
      messageSent: true,
    };
  } catch (error: any) {
    console.error("Error kicking user:", error);
    const errorMessage =
      error?.graphQLErrors?.[0]?.message || error.message || "Unknown error";

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `Failed to kick user: ${errorMessage}`,
      feedType: ctx.feedType,
    });

    return {
      success: false,
      message: `Failed to kick user: ${errorMessage}`,
      messageSent: true,
    };
  }
}

/**
 * Handle webhook on kick command failure
 * Only sends webhook for legitimate API/system errors, not user errors
 */
export async function handleKickFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: KickArgs
): Promise<void> {
  if (result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Kicking User", result.message, {
      targetUserId: args.targetUserId,
      reason: args.reason,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }
}
