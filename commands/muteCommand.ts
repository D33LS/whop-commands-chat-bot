import { muteUser } from "@/lib/whopClient/userApi";
import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { sendMuteWebhook } from "@/lib/webhooks/ModerationWebhooks";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { formatDate } from "@/lib/utils";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface MuteArgs {
  targetUserId: string;
  duration?: number;
  durationText?: string;
  reason?: string;
}

/**
 * Parse the /mute command with support for minutes, days, and weeks
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the mute command
 */
export function parseMuteCommand(
  raw: string,
  mentionedUserIds: string[] = []
): MuteArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return {
      targetUserId: "",
      duration: undefined,
      durationText: undefined,
      reason: undefined,
    };
  }

  const targetUserId = mentionedUserIds[0];
  const durationMatch = raw.match(/\b(\d+)([mdw]?)\b/i);
  let duration: number | undefined;
  let durationText: string | undefined;
  let reason: string | undefined;

  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    const unit = (durationMatch[2] || "m").toLowerCase();
    let durationInSeconds: number;

    switch (unit) {
      case "m":
        durationInSeconds = value * 60;
        durationText = `for ${value} minute${value === 1 ? "" : "s"}`;
        break;
      case "d":
        durationInSeconds = value * 86400;
        durationText = `for ${value} day${value === 1 ? "" : "s"}`;
        break;
      case "w":
        durationInSeconds = value * 604800;
        durationText = `for ${value} week${value === 1 ? "" : "s"}`;
        break;
      default:
        durationInSeconds = value * 60;
        durationText = `for ${value} minute${value === 1 ? "" : "s"}`;
    }

    duration = durationInSeconds;

    const afterDuration = raw.substring(
      raw.indexOf(durationMatch[0]) + durationMatch[0].length
    );
    const reasonText = afterDuration.trim();
    if (reasonText && reasonText !== ",") {
      reason = reasonText;
    }
  } else {
    const usernameMatch = raw.match(/@\w+/);
    if (usernameMatch) {
      const afterUsername = raw.substring(
        raw.indexOf(usernameMatch[0]) + usernameMatch[0].length
      );
      const reasonText = afterUsername.trim();
      if (reasonText && reasonText !== ",") {
        reason = reasonText;
      }
    }
  }

  return { targetUserId, duration, durationText, reason };
}

/**
 * Execute the /mute command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeMuteCommand(
  args: MuteArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId, duration, durationText, reason } = args;

  if (targetUserId === ctx.userId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "You cannot mute yourself.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Self-mute attempt rejected",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (!targetUserId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Must provide a target user to mute (e.g., @TestBot)",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Missing target user",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (!duration) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "Must provide a duration for the mute (e.g., 5m, 2d, 1w)",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Missing duration",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const mutedUntil = Math.floor(Date.now() / 1000) + duration;
  const muteInput = {
    userId: targetUserId,
    mutedUntil: mutedUntil,
  };

  const displayDurationText = durationText || "indefinitely";
  const reasonText = reason ? ` (Reason: ${reason})` : "";

  try {
    const result = await muteUser(muteInput);

    const message = `User has been muted ${displayDurationText}${reasonText}.`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("already muted")) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `User is already muted. Duration updated to ${displayDurationText}.`,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: `User is already muted but duration updated to ${displayDurationText}`,
        data: {
          targetUserId,
          duration,
          mutedUntil,
          reason,
        },
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
    await sendMuteWebhook(
      targetUserId,
      targetUsername,
      ctx.userId,
      moderatorUsername,
      duration,
      reason,
      targetName,
      targetAvatar,
      moderatorName,
      createdAt
    );
  } catch (webhookError) {
    console.error("Error sending mute webhook:", webhookError);
  }

  return {
    success: true,
    message: `User has been muted ${displayDurationText}${reasonText}`,
    data: {
      targetUserId,
      duration,
      mutedUntil,
      reason,
    },
    messageSent: true,
  };
}

/**
 * Handle / send webhook on mute command failure for Whop admins
 */
export async function handleMuteFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: MuteArgs
): Promise<void> {
  if (result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Muting User", result.message, {
      targetUserId: args.targetUserId,
      duration: args.duration,
      reason: args.reason,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }
}
