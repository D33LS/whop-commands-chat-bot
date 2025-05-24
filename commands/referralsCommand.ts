import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { getUserReferrals, getUserInfo } from "@/lib/whopClient/userApi";

interface ReferralsArgs {
  targetUserId: string;
}

/**
 * Parse the /referrals command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the referrals command
 */
export function parseReferralsCommand(
  raw: string,
  mentionedUserIds: string[] = []
): ReferralsArgs {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return { targetUserId: "self" };
  }
  const targetUserId = mentionedUserIds[0];
  return { targetUserId };
}

/**
 * Execute the /referrals command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeReferralsCommand(
  args: ReferralsArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const targetUserId =
    args.targetUserId === "self" ? ctx.userId : args.targetUserId;
  const isSelf = targetUserId === ctx.userId;

  const userInfo = await getUserInfo(targetUserId);
  const username = userInfo.username || targetUserId;

  const userReferrals = await getUserReferrals(targetUserId);
  const referralCount = userReferrals.primaryUserReferralCountLast24Hours || 0;

  if (referralCount === 0 && !isSelf) {
    const message = `@${username} hasn't referred anyone in the last 24 hours.`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });
  } else if (referralCount === 0) {
    const message = `You haven't referred anyone in the last 24 hours. Share your affiliate link to start earning!`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });
  } else if (isSelf) {
    const message = `🔄 Your referrals in the last 24 hours: ${referralCount}`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });
  } else {
    const message = `🔄 Referrals for @${username} in the last 24 hours: ${referralCount}`;
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });
  }

  return {
    success: true,
    message: "Referrals data fetched successfully",
    data: {
      targetUserId,
      username,
      referralCount,
    },
    messageSent: true,
  };
}
