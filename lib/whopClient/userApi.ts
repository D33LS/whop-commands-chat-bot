import { whop } from "./ApolloGraphQLClient";
import { gql } from "@apollo/client";
import {
  CreateCompanyMutedUserInput,
  DeleteCompanyMutedUserInput,
  User,
  EarningsReport,
  UnbanUserInput,
  BanUserInput,
  KickFromAWhopInput,
} from "./graphql/types";

interface UserEarningsResponse {
  id: string;
  username?: string;
  earningsReports?: {
    nodes: EarningsReport[];
  };
}

interface UserReferralsResponse {
  id: string;
  primaryUserReferralCountLast24Hours: number;
}

export const KICK_USER_MUTATION = gql`
  mutation KickFromAWhop($input: KickFromAWhopInput!) {
    kickFromAWhop(input: $input)
  }
`;

export const MUTE_USER_MUTATION = gql`
  mutation CreateCompanyMutedUser($input: CreateCompanyMutedUserInput!) {
    createCompanyMutedUser(input: $input)
  }
`;

export const UNMUTE_USER_MUTATION = gql`
  mutation DeleteCompanyMutedUser($input: DeleteCompanyMutedUserInput!) {
    deleteCompanyMutedUser(input: $input)
  }
`;

export const BAN_USER_MUTATION = gql`
  mutation banUser($input: BanUserInput!) {
    banUser(input: $input)
  }
`;

export const UNBAN_USER_MUTATION = gql`
  mutation unbanUser($input: UnbanUserInput!) {
    unbanUser(input: $input)
  }
`;

export const GET_USER_QUERY = gql`
  query GetUser($id: ID!) {
    publicUser(id: $id) {
      id
      username
      name
      profilePic
      createdAt
      positiveBulletinBoardBadgePercentage
    }
  }
`;

export const GET_USER_EARNINGS_QUERY = gql`
  query GetUserEarnings($id: ID!) {
    publicUser(id: $id) {
      id
      username
      earningsReports {
        nodes {
          earningsType
          last24Hours
          last7Days
          last30Days
          lifetime
        }
      }
    }
  }
`;

export const GET_USER_REFERRALS_QUERY = gql`
  query GetUserReferrals($publicUserId: ID!) {
    publicUser(id: $publicUserId) {
      primaryUserReferralCountLast24Hours
    }
  }
`;

/**
 * Kick a user from a Whop
 * @param userId The ID of the user to kick
 * @returns The result of the kick operation
 */
export async function kickUser(input: KickFromAWhopInput): Promise<string> {
  const data = await whop.callGraphQL<{ kickFromAWhop: string }>(
    KICK_USER_MUTATION,
    { input }
  );
  return data.kickFromAWhop;
}

/**
 * Mute a user
 * @param input The mute user input
 * @returns The result of the mute operation
 */
export async function muteUser(
  input: CreateCompanyMutedUserInput
): Promise<string> {
  const data = await whop.callGraphQL<{ createCompanyMutedUser: string }>(
    MUTE_USER_MUTATION,
    { input }
  );
  return data.createCompanyMutedUser;
}

/**
 * Unmute a user
 * @param userId The ID of the user to unmute
 * @returns The result of the unmute operation
 */
export async function unmuteUser(userId: string): Promise<string> {
  const input: DeleteCompanyMutedUserInput = { userId };
  const data = await whop.callGraphQL<{ deleteCompanyMutedUser: string }>(
    UNMUTE_USER_MUTATION,
    { input }
  );
  return data.deleteCompanyMutedUser;
}

/**
 * Get user information
 * @param userId The ID of the user to get info for
 * @returns The user information
 */
export async function getUserInfo(userId: string): Promise<Partial<User>> {
  try {
    const data = await whop.callGraphQL<{ publicUser: Partial<User> }>(
      GET_USER_QUERY,
      { id: userId }
    );
    return data.publicUser || { id: userId };
  } catch (error) {
    console.error(`Error getting user info for ${userId}:`, error);
    return { id: userId };
  }
}

/**
 * Get user earnings information
 * @param userId The ID of the user to get earnings for
 * @returns The user earnings data
 */
export async function getUserEarnings(
  userId: string
): Promise<UserEarningsResponse> {
  try {
    const data = await whop.callGraphQL<{ publicUser: UserEarningsResponse }>(
      GET_USER_EARNINGS_QUERY,
      { id: userId }
    );
    return data.publicUser || { id: userId, earningsReports: { nodes: [] } };
  } catch (error) {
    console.error(`Error getting earnings for user ${userId}:`, error);
    return { id: userId, earningsReports: { nodes: [] } };
  }
}

/**
 * Get user referrals information
 * @param userId The ID of the user to get referrals for
 * @returns The user referrals data
 */
export async function getUserReferrals(
  userId: string
): Promise<UserReferralsResponse> {
  try {
    const data = await whop.callGraphQL<{ publicUser: UserReferralsResponse }>(
      GET_USER_REFERRALS_QUERY,
      { publicUserId: userId }
    );

    return (
      data.publicUser || {
        id: userId,
        primaryUserReferralCountLast24Hours: 0,
      }
    );
  } catch (error) {
    console.error(`Error getting referrals for user ${userId}:`, error);
    return {
      id: userId,
      primaryUserReferralCountLast24Hours: 0,
    };
  }
}

/**
 * Ban a user
 * @param input The ban user input
 * @returns The result of the ban operation
 */
export async function banUser(input: BanUserInput): Promise<string> {
  const data = await whop.callGraphQL<{ banUser: string }>(BAN_USER_MUTATION, {
    input,
  });
  return data.banUser;
}

/**
 * Unban a user
 * @param input The unban user input
 * @returns The result of the unban operation
 */
export async function unbanUser(input: UnbanUserInput): Promise<string> {
  const data = await whop.callGraphQL<{ unbanUser: string }>(
    UNBAN_USER_MUTATION,
    {
      input,
    }
  );
  return data.unbanUser;
}
