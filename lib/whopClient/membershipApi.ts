import { whop } from "./ApolloGraphQLClient";
import { gql } from "@apollo/client";
import {
  Membership,
  MembershipActions,
  UpdateMembershipInput,
} from "./graphql/types";

export const UPDATE_MEMBERSHIP_MUTATION = gql`
  mutation UpdateMembership($input: UpdateMembershipInput!) {
    updateMembership(input: $input) {
      member {
        id
      }
    }
  }
`;

export const GET_USER_MEMBERSHIPS_QUERY = gql`
  query GetUserMemberships($userId: ID!) {
    publicUser(id: $userId) {
      id
      username
      name
      memberships {
        nodes {
          id
          status
          expiresAt
          product {
            id
            name
          }
          experienceAccess {
            id
            experience {
              id
              name
            }
          }
        }
      }
    }
  }
`;

const GET_USER_AND_MEMBERSHIPS = gql`
  query GetUserAndMemberships($userId: ID!, $companyId: ID!) {
    publicUser(id: $userId) {
      id
      username
      name
      profilePic
    }
    company(id: $companyId) {
      companyMember(id: $userId) {
        id
        user {
          id
          username
          name
        }
        memberships {
          nodes {
            id
            status
            expiresAt
            accessPass {
              id
              name
              experiences {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

const GET_COMPANY_MEMBER_MEMBERSHIPS = gql`
  query GetCompanyMemberMemberships($companyId: ID!, $userId: ID!) {
    company(id: $companyId) {
      companyMember(id: $userId) {
        id
        user {
          id
          username
          name
        }
        memberships {
          nodes {
            id
            status
            expiresAt
            accessPass {
              id
              name
              experiences {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

export interface PublicExperienceWithCompany {
  id: string;
  name?: string;
  company: {
    id: string;
  };
}

export interface CompanyMemberMemberships {
  id: string;
  user: {
    id: string;
    username?: string;
    name?: string;
  };
  memberships: {
    nodes: Array<{
      id: string;
      status?: string;
      expiresAt?: string;
      accessPass?: {
        id: string;
        name?: string;
        experiences?: Array<{
          id: string;
          name?: string;
        }>;
      };
    }>;
  };
}

export interface ChatFeedWithExperience {
  chatFeed: {
    id: string;
    experienceId: string;
    createdAt?: string;
    updatedAt?: string;
  };
  publicExperience: {
    id: string;
    name?: string;
    company: {
      id: string;
    };
  };
}

export interface UserAndMemberships {
  publicUser: {
    id: string;
    username?: string;
    name?: string;
    profilePic?: string;
  };
  company: {
    companyMember: {
      id: string;
      user: {
        id: string;
        username?: string;
        name?: string;
      };
      memberships: {
        nodes: Array<{
          id: string;
          status?: string;
          expiresAt?: string;
          accessPass?: {
            id: string;
            name?: string;
            experiences?: Array<{
              id: string;
              name?: string;
            }>;
          };
        }>;
      };
    };
  };
}


export async function getChatFeedWithExperience(feedId: string): Promise<{
  experienceId: string;
  companyId: string;
  experienceName?: string;
} | null> {
  try {

    const feedData = await whop.callGraphQL<{
      chatFeed: { experienceId: string };
    }>(
      gql`
        query GetChatFeedExperienceId($feedId: ID!) {
          chatFeed(feedId: $feedId) {
            experienceId
          }
        }
      `,
      { feedId }
    );

    const experienceId = feedData.chatFeed?.experienceId;
    if (!experienceId) return null;

    const experienceData = await whop.callGraphQL<{
      publicExperience: {
        id: string;
        name?: string;
        company: { id: string };
      };
    }>(
      gql`
        query GetExperience($experienceId: ID!) {
          publicExperience(id: $experienceId) {
            id
            name
            company {
              id
            }
          }
        }
      `,
      { experienceId }
    );

    return {
      experienceId,
      companyId: experienceData.publicExperience.company.id,
      experienceName: experienceData.publicExperience.name,
    };
  } catch (error) {
    console.error("Error getting chat feed with experience:", error);
    return null;
  }
}


export async function getUserAndMemberships(
  userId: string,
  companyId: string
): Promise<UserAndMemberships | null> {
  try {
    const data = await whop.callGraphQL<UserAndMemberships>(
      GET_USER_AND_MEMBERSHIPS,
      { userId, companyId }
    );

    return data;
  } catch (error) {
    console.error("Error getting user and memberships:", error);
    return null;
  }
}

/**
 * Update a membership with various actions
 * @param input The update membership input
 * @returns The updated membership
 */
export async function updateMembership(
  input: UpdateMembershipInput
): Promise<{ member: Partial<Membership> }> {
  try {
    const data = await whop.callGraphQL<{
      updateMembership: { member: Partial<Membership> };
    }>(UPDATE_MEMBERSHIP_MUTATION, { input });
    return data.updateMembership;
  } catch (err: any) {
    /* Re-throw with friendlier context so call-sites can surface meaningful feedback */
    throw new Error(
      `Failed to update membership ${input.id ?? ""}: ${err.message ?? err}`
    );
  }
}

/**
 * Add free days to a membership
 * @param membershipId The ID of the membership
 * @param freeDays The number of free days to add
 * @returns The updated membership
 */
export async function addFreeDaysToMembership(
  membershipId: string,
  freeDays: number
): Promise<{ member: Partial<Membership> }> {
  const input: UpdateMembershipInput = {
    id: membershipId,
    membershipAction: MembershipActions.AddFreeDays,
    freeDays,
  };

  return updateMembership(input);
}

/**
 * Get all memberships for a user
 * @param userId The ID of the user
 * @returns The user's memberships
 */
export async function getUserMemberships(userId: string): Promise<{
  id: string;
  username?: string;
  name?: string;
  memberships: {
    nodes: Array<Partial<Membership>>;
  };
}> {
  const data = await whop.callGraphQL<{
    publicUser: {
      id: string;
      username?: string;
      name?: string;
      memberships: {
        nodes: Array<Partial<Membership>>;
      };
    };
  }>(GET_USER_MEMBERSHIPS_QUERY, { userId });

  return data.publicUser || { id: userId, memberships: { nodes: [] } };
}

/**
 * Get company member with their memberships
 * @param companyId The ID of the company
 * @param userId The ID of the user
 * @returns The company member with memberships
 */
export async function getCompanyMemberMemberships(
  companyId: string,
  userId: string
): Promise<CompanyMemberMemberships | null> {
  try {
    const data = await whop.callGraphQL<{
      company: {
        companyMember: CompanyMemberMemberships;
      };
    }>(GET_COMPANY_MEMBER_MEMBERSHIPS, { companyId, userId });

    return data.company?.companyMember || null;
  } catch (error) {
    console.error("Error getting company member memberships:", error);
    return null;
  }
}

export async function getAddFreeDaysData(
  feedId: string,
  targetUserId: string
): Promise<{
  experienceId: string;
  companyId: string;
  experienceName?: string;
  targetUser: {
    id: string;
    username?: string;
    name?: string;
  };
  memberships: Array<{
    id: string;
    status?: string;
    expiresAt?: string;
    accessPass?: {
      id: string;
      name?: string;
      experiences?: Array<{
        id: string;
        name?: string;
      }>;
    };
  }>;
} | null> {
  try {
    const feedExperienceData = await getChatFeedWithExperience(feedId);
    if (!feedExperienceData) return null;

    const userMembershipData = await getUserAndMemberships(
      targetUserId,
      feedExperienceData.companyId
    );
    if (!userMembershipData) return null;

    return {
      experienceId: feedExperienceData.experienceId,
      companyId: feedExperienceData.companyId,
      experienceName: feedExperienceData.experienceName,
      targetUser: userMembershipData.publicUser,
      memberships: userMembershipData.company.companyMember.memberships.nodes,
    };
  } catch (error) {
    console.error("Error getting add free days data:", error);
    return null;
  }
}
