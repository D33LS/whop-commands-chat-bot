import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { getChatFeedWithExperience } from "@/lib/whopClient/membershipApi";
import { getExperienceDetails } from "@/lib/whopClient/experienceApi";
import { getUserInfo } from "@/lib/whopClient/userApi";

interface AffiliateLinkArgs {
  targetUserId: string;
}

/**
 * Build affiliate link from access pass title and username
 * Format: https://whop.com/accesspass-title/?a=username
 */
export function buildAffiliateLink(
  accessPassRoute: string,
  username: string
): string {
  return `https://whop.com/${encodeURIComponent(
    accessPassRoute
  )}/?a=${encodeURIComponent(username)}`;
}

/**
 * Parse the /affiliatelink command
 */
export function parseAffiliateLinkCommand(
  raw: string,
  mentionedUserIds: string[] = []
): AffiliateLinkArgs {
  const targetUserId =
    mentionedUserIds.length > 0 ? mentionedUserIds[0] : "self";
  return { targetUserId };
}

/**
 * Execute the /affiliatelink command
 */
export async function executeAffiliateLinkCommand(
  args: AffiliateLinkArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const targetUserId =
    args.targetUserId === "self" ? ctx.userId : args.targetUserId;
  const isSelf = targetUserId === ctx.userId;

  try {
    // Step 1 & 2: Get experience ID
    const feedExperienceData = await getChatFeedWithExperience(ctx.feedId);
    if (!feedExperienceData) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "❌ Could not determine the experience for this chat.",
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "Could not determine experience",
        messageSent: true,
        skipWebhook: true,
      };
    }

    // Step 3: Get access pass title for this experience
    const accessPassData = await getExperienceDetails(
      feedExperienceData.experienceId
    );
    if (!accessPassData || !accessPassData.accessPasses) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "❌ Could not find access pass for this experience.",
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "Could not get access pass title",
        messageSent: true,
        skipWebhook: true,
      };
    }

    if (accessPassData.accessPasses.length === 0) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "❌ No access passes available for this experience.",
        feedType: ctx.feedType,
      });
      return {
        success: false,
        message: "No access passes available",
        messageSent: true,
        skipWebhook: true,
      };
    }

    // Step 4: Get user info
    const userInfo = await getUserInfo(targetUserId);
    if (!userInfo) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "❌ Unable to find that user.",
        feedType: ctx.feedType,
      });
      return { success: false, message: "User not found", messageSent: true };
    }
    const targetUsername = userInfo.username ?? targetUserId;

    const affiliateLink = buildAffiliateLink(
      accessPassData.accessPasses[0].route,
      targetUsername
    );

    const message = isSelf
      ? `🔗 Your ${accessPassData.accessPasses[0].title} Affiliate Link\n${affiliateLink}\n\n💰 Share this link to earn commissions!`
      : `🔗 ${accessPassData.accessPasses[0].title} Affiliate Link for @${targetUsername}\n${affiliateLink}\n\n💰 Share this link to earn commissions!`;

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: "Affiliate link generated successfully",
      data: {
        targetUserId,
        targetUsername,
        affiliateLink,
        accessPassData,
      },
      messageSent: true,
    };
  } catch (error: any) {
    console.error("Error generating affiliate link:", error);

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "❌ Failed to generate affiliate link. Please try again later.",
      feedType: ctx.feedType,
    });

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      data: { targetUserId },
      messageSent: true,
    };
  }
}
