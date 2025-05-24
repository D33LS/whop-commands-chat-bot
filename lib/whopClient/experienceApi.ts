import { whop } from "./ApolloGraphQLClient";
import { gql } from "@apollo/client";
import { PublicExperience } from "./graphql/types";

const GET_EXPERIENCE_DETAILS = gql`
  query GetExperienceDetails($experienceId: ID!) {
    publicExperience(id: $experienceId) {
      id
      name
      app {
        id
      }
      company {
        id
      }
      accessPasses {
        id
        title
        route
        experiences {
          id
        }
      }
    }
  }
`;

/**
 * Get all experience details in one query (recommended)
 * @param experienceId The ID of the experience
 * @returns Complete experience details
 */
export async function getExperienceDetails(
  experienceId: string
): Promise<PublicExperience | null> {
  try {
    const data = await whop.callGraphQL<{
      publicExperience: PublicExperience;
    }>(GET_EXPERIENCE_DETAILS, { experienceId });

    return data.publicExperience || null;
  } catch (error) {
    console.error("Error getting experience details:", error);
    return null;
  }
}
