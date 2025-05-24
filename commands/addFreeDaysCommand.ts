import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import {
  addFreeDaysToMembership,
  getAddFreeDaysData,
} from "@/lib/whopClient/membershipApi";
import { logInfo } from "@/lib/webhooks/LogWebhooks";

interface AddFreeDaysArgs {
  targetUserId: string;
  days: number;
}

/**
 * Parse the /addfreedays command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the add free days command
 */
export function parseAddFreeDaysCommand(
  raw: string,
  mentionedUserIds: string[] = []
): AddFreeDaysArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    throw new Error("Usage: /addfreedays @username [days]");
  }

  const targetUserId = mentionedUserIds[0];
  const parts = raw.split(/\s+/);

  // Look for a number in the command (days to add)
  let days = 7; // Default to 7 days
  for (const part of parts) {
    const parsedDays = parseInt(part, 10);
    if (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) {
      days = parsedDays;
      break;
    }
  }

  return { targetUserId, days };
}

/**
 * Execute the /addfreedays command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeAddFreeDaysCommand(
  args: AddFreeDaysArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { targetUserId, days } = args;

  if (targetUserId === ctx.userId) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "You cannot add free days to yourself.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Self-targeting not allowed",
      messageSent: true,
      skipWebhook: true,
    };
  }

  try {
    const data = await getAddFreeDaysData(ctx.feedId, targetUserId);

    if (!data) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "❌ Could not retrieve the required data for this operation.",
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "Failed to get required data",
        messageSent: true,
        skipWebhook: true,
      };
    }

    const { experienceId, targetUser, memberships } = data;
    const targetUsername = targetUser.username || targetUserId;

    const relevantMembership = memberships.find((membership) => {
      return membership.accessPass?.experiences?.some(
        (experience) => experience.id === experienceId
      );
    });

    if (!relevantMembership) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `❌ User @${targetUsername} doesn't have a membership for this experience.`,
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "User has no membership for this experience",
        messageSent: true,
        skipWebhook: true,
      };
    }
    const result = await addFreeDaysToMembership(relevantMembership.id!, days);

    let expirationText = "";
    if (result.member.expiresAt) {
      const expirationDate = new Date(result.member.expiresAt);
      expirationText = ` (now expires: ${expirationDate.toLocaleDateString()})`;
    }

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `✅ Added ${days} free day${
        days === 1 ? "" : "s"
      } to @${targetUsername}'s membership${expirationText}.`,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: `Successfully added ${days} free days to user's membership`,
      data: {
        targetUserId,
        targetUsername,
        days,
        membershipId: relevantMembership.id,
        newExpiresAt: result.member.expiresAt,
      },
      messageSent: true,
    };
  } catch (error: any) {
    console.error("Error adding free days:", error);

    const errorMessage = error.message?.includes("membership")
      ? error.message
      : "Failed to add free days. Please try again later.";

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `❌ ${errorMessage}`,
      feedType: ctx.feedType,
    });

    return {
      success: false,
      message: error.message || "Unknown error occurred",
      data: { targetUserId, days },
      messageSent: true,
    };
  }
}

/**
 * Handle add free days command failures
 */
export async function handleAddFreeDaysFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: AddFreeDaysArgs
): Promise<void> {
  if (result.messageSent || result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Adding Free Days", result.message, {
      targetUserId: args.targetUserId,
      days: args.days,
      moderatorId: ctx.userId,
      feedId: ctx.feedId,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error logging add free days failure:", logErr);
  }
}
