import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { getUserEarnings, getUserInfo } from "@/lib/whopClient/userApi";
import { formatCurrency } from "@/lib/utils";

interface EarningsArgs {
  targetUserId: string;
}

/**
 * Parse the /earnings command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the earnings command
 */
export function parseEarningsCommand(
  raw: string,
  mentionedUserIds: string[] = []
): EarningsArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return { targetUserId: "self" };
  }
  const targetUserId = mentionedUserIds[0];
  return { targetUserId };
}

/**
 * Execute the /earnings command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeEarningsCommand(
  args: EarningsArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const targetUserId =
    args.targetUserId === "self" ? ctx.userId : args.targetUserId;
  const isSelf = targetUserId === ctx.userId;

  const userInfo = await getUserInfo(targetUserId);
  const username = userInfo.username || targetUserId;

  const userEarnings = await getUserEarnings(targetUserId);
  const earningsReports = userEarnings.earningsReports?.nodes || [];

  if (!earningsReports.length) {
    const message = isSelf
      ? "Your earnings are hidden."
      : `@${username} has their earnings hidden.`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: "No earnings found",
      data: { targetUserId, username },
      messageSent: true,
    };
  }

  let total24hours = 0;
  earningsReports.forEach((report) => {
    total24hours += report.last24Hours || 0;
  });

  const message = isSelf
    ? `💰 Your 24-hour Earnings ${formatCurrency(total24hours)}`
    : `💰 24-hour Earnings for @${username} ${formatCurrency(total24hours)}`;

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message,
    feedType: ctx.feedType,
  });

  return {
    success: true,
    message: "Earnings data fetched successfully",
    data: {
      targetUserId,
      username,
      total24hours,
    },
    messageSent: true,
  };
}
