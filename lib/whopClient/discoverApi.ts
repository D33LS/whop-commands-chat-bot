import { whop } from "./ApolloGraphQLClient";
import { gql } from "@apollo/client";

const DISCOVER_CAMPAIGNS_QUERY = gql`
  query DiscoverContentRewardsCampaigns(
    $contentType: ContentRewardsContentType
    $category: ContentRewardsCategory
    $platform: ContentRewardsPlatform
    $orderBy: CampaignOrder
    $first: Int
  ) {
    discoverContentRewardsCampaigns(
      contentType: $contentType
      category: $category
      platform: $platform
      orderBy: $orderBy
      first: $first
    ) {
      totalCount
      nodes {
        id
        title
        category
        contentType
        totalBudget
        totalPaid
        fixedRewardPerSubmission
        rewardRatePerThousandViews
        status
        createdAt
      }
    }
  }
`;

export const getDiscoverContentRewardsCampaigns = async (
  contentType: string | null,
  category: string | null,
  platform: string | null,
  orderBy: string,
  first: number
): Promise<{
  totalCount: number;
  nodes: any[];
}> => {
  const variables = {
    contentType: contentType,
    category: category,
    platform: platform,
    orderBy: orderBy,
    first: first,
  };

  const data = await whop.callGraphQL<any>(DISCOVER_CAMPAIGNS_QUERY, variables);

  return data.discoverContentRewardsCampaigns;
};
