import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { getDiscoverContentRewardsCampaigns } from "@/lib/whopClient/discoverApi";
import { sendContentRewardsWebhook } from "@/lib/webhooks/CommandWebhooks";
import { retryWithBackoff } from "@/lib/utils";

//whop removed discover api :(

export interface ContentRewardsArgs {
  contentType: string | null;
  category: string | null;
  platform: string | null;
  orderBy: string;
}

const contentTypeMap: Record<string, string> = {
  clipping: "clipping",
  ugc: "ugc",
  faceless: "faceless",
  other: "other",
};

const categoryMap: Record<string, string> = {
  entertainment: "entertainment",
  logo: "logo",
  music: "music",
  other: "other",
  "personal brand": "personal_brand",
  personal: "personal_brand",
  products: "products",
};

const platformMap: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  x: "x",
  twitter: "x",
  youtube: "youtube",
  yt: "youtube",
};

const orderByMap: Record<string, string> = {
  budget: "highest_available_budget",
  new: "newest",
  newest: "newest",
  rate: "reward_rate_per_thousand_views",
  payout: "total_paid_out",
  paid: "total_paid_out",
};

/**
 * Parse the /contentrewards command
 * @param raw The raw command string
 * @returns The parsed arguments for the content rewards command
 */
export function parseContentRewardsCommand(raw: string): ContentRewardsArgs {
  let contentType: string | null = "clipping";
  let category: string | null = null;
  let platform: string | null = null;
  let orderBy: string = "highest_available_budget";

  const parts = raw.split(/\s+/).slice(1);

  for (const part of parts) {
    const lowercasePart = part.toLowerCase();

    if (contentTypeMap[lowercasePart]) {
      contentType = contentTypeMap[lowercasePart];
      continue;
    }
    if (categoryMap[lowercasePart]) {
      category = categoryMap[lowercasePart];
      continue;
    }
    if (platformMap[lowercasePart]) {
      platform = platformMap[lowercasePart];
      continue;
    }
    if (orderByMap[lowercasePart]) {
      orderBy = orderByMap[lowercasePart];
      continue;
    }
  }

  return { contentType, category, platform, orderBy };
}

/**
 * Execute the /contentrewards command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeContentRewardsCommand(
  args: ContentRewardsArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { contentType, category, platform, orderBy } = args;
  const campaignsData = await getDiscoverContentRewardsCampaigns(
    contentType,
    category,
    platform,
    orderBy,
    5
  );

  const campaigns = campaignsData.nodes || [];
  const totalCount = campaignsData.totalCount || 0;

  if (!campaigns || campaigns.length === 0) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "No content rewards campaigns found with the specified criteria.",
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: "No content rewards campaigns found",
      data: { totalCount: 0 },
      messageSent: true,
      skipWebhook: true,
    };
  }

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: `Found ${totalCount} content rewards campaigns matching your criteria. Sending the top ${campaigns.length} to the webhook!`,
    feedType: ctx.feedType,
  });

  try {
    await retryWithBackoff(
      () => sendContentRewardsWebhook(campaigns, args, totalCount),
      3,
      500
    );

    return {
      success: true,
      message: "Content rewards campaigns fetched successfully",
      data: { totalCount },
      messageSent: true,
    };
  } catch (error) {
    console.error("Error sending webhook:", error);
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "⚠️ Found campaigns but couldn't send them to the webhook. Please try again later or check with an admin.",
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: "Content rewards campaigns found, but webhook failed to send",
      data: {
        totalCount,
        error: error instanceof Error ? error.message : String(error),
      },
      messageSent: true,
    };
  }
}
