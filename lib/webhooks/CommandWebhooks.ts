import { WebhookService } from "@/lib/webhooks/WebhookService";
import { formatNumberWithCommas, formatDate } from "@/lib/utils";
import { ContentRewardsArgs } from "@/commands/contentRewardsCommand";

const validUrlCategoryMap: Record<string, string> = {
  entertainment: "entertainment",
  personal_brand: "personal_brand",
  software: "software",
  stream: "stream",
  logo: "logo",
  music: "music",
  other: "other",
};

const validUrlContentTypeMap: Record<string, string> = {
  ugc: "ugc",
  clipping: "clipping",
};

function generateWhopUrl(args: ContentRewardsArgs): string {
  const baseUrl = "https://whop.com/discover/explore/content-rewards";

  if (!args.contentType && !args.category) {
    return baseUrl;
  }

  const urlParts: string[] = [];

  if (args.contentType && validUrlContentTypeMap[args.contentType]) {
    urlParts.push(`c/${args.contentType}`);
  }
  if (args.category && validUrlCategoryMap[args.category]) {
    urlParts.push(`ct/${args.category}`);
  }

  urlParts.push("p/0");

  if (urlParts.length > 0) {
    return `${baseUrl}/${urlParts.join("/")}`;
  }

  return baseUrl;
}

/**
 * Send a webhook with the content rewards campaigns
 * @param campaigns The campaigns to send
 * @param args The original command arguments
 * @param totalCount The total number of campaigns found
 */
export async function sendContentRewardsWebhook(
  campaigns: any[],
  args: ContentRewardsArgs,
  totalCount: number
): Promise<void> {
  const webhookService = WebhookService.getInstance();
  const whopUrl = generateWhopUrl(args);

  const filterDescription = [
    args.contentType ? `Content Type: ${args.contentType}` : null,
    args.category ? `Category: ${args.category}` : null,
    args.platform ? `Platform: ${args.platform}` : null,
    `Order: ${args.orderBy.replace(/_/g, " ")}`,
  ]
    .filter(Boolean)
    .join(", ");

  const fields = campaigns.map((campaign, index) => {
    let rewardText = "";
    if (campaign.fixedRewardPerSubmission) {
      rewardText = `$${formatNumberWithCommas(
        campaign.fixedRewardPerSubmission
      )} per submission`;
    } else if (campaign.rewardRatePerThousandViews) {
      rewardText = `$${formatNumberWithCommas(
        campaign.rewardRatePerThousandViews
      )} per 1k views`;
    }

    const budget = `$${formatNumberWithCommas(campaign.totalBudget)}`;
    const createdDate = formatDate(campaign.createdAt);

    return {
      name: `${index + 1}. ${campaign.title}`,
      value: `
Type: **${campaign.contentType}** | Category: **${campaign.category}**
Budget: **${budget}** | Reward: **${rewardText}**
Status: **${campaign.status}** | Created: **${createdDate}**
[View Campaign](https://whop.com/content-rewards/${campaign.id})
      `.trim(),
      inline: false,
    };
  });

  const embed = webhookService.createRichEmbed({
    title: "📊 Top Content Rewards Campaigns",
    url: whopUrl,
    description: `Showing top ${campaigns.length} of ${totalCount} campaigns ${
      filterDescription ? `(${filterDescription})` : ""
    }`,
    color: 0xfa4616,
    fields,
    footer: {
      text: `Whop Content Rewards`,
      icon_url: "https://whop.com/favicon.ico",
    },
  });

  const content = `Here are the top content rewards campaigns on Whop!`;

  try {
    await webhookService.sendContentWithEmbeds("content_rewards", content, [
      embed,
    ]);
  } catch (error) {
    console.error("Error sending content rewards webhook:", error);
  }
}
