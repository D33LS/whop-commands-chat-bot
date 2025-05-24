import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DEE_API_KEY", "DEE_USER_ID", "DEE_COMPANY_ID"];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const API_KEY = process.env.WHOP_API_KEY;
const CHAT_USER_ID = process.env.WHOP_USER_ID;
const COMPANY_ID = process.env.WHOP_COMPANY_ID;

const [, , publicCompanyId] = process.argv;
if (!publicCompanyId) {
  console.error(
    'Usage: ts-node scripts/get-company-users.ts "public_company_id"'
  );
  process.exit(1);
}

console.log(`Fetching users for company ${publicCompanyId}`);
console.log(`Using Auth User: ${CHAT_USER_ID}`);

const GET_COMPANY_USERS_QUERY = `
  query PublicCompany($publicCompanyId: ID!) {
    publicCompany(id: $publicCompanyId) {
      members {
        nodes {
          id
          ... on ExtraPublicMember {
            profile {
              id
              username
              name
              profilePic
              createdAt
              positiveBulletinBoardBadgePercentage
              userNumber
              lastActiveAt
            }
          }
        }
      }
    }
  }
`;

async function getCompanyUsers(publicCompanyId: string) {
  try {
    const variables = {
      publicCompanyId: publicCompanyId,
    };

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: GET_COMPANY_USERS_QUERY,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "x-on-behalf-of": CHAT_USER_ID,
          "x-company-id": COMPANY_ID,
        },
      }
    );

    if (response.data.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(response.data.errors, null, 2)
      );
      return;
    }

    const company = response.data.data.publicCompany;
    if (company && company.members && company.members.nodes) {
      const members = company.members.nodes;
      console.log(`✅ Found ${members.length} company members:`);

      // Filter out members with valid profiles
      const validMembers = members.filter((member: any) => member.profile);
      const invalidMembers = members.filter((member: any) => !member.profile);

      console.log("Valid members with profiles:");
      console.log(JSON.stringify(validMembers, null, 2));

      if (invalidMembers.length > 0) {
        console.log(
          `\n⚠️ ${invalidMembers.length} members have missing profiles (IDs only):`
        );
        console.log(invalidMembers.map((m: any) => m.id));
      }

      // Optional: Show summary statistics for valid profiles
      const validPercentages = validMembers
        .map(
          (member: any) => member.profile?.positiveBulletinBoardBadgePercentage
        )
        .filter(
          (percentage: any) => percentage !== null && percentage !== undefined
        );

      if (validPercentages.length > 0) {
        const avgPercentage =
          validPercentages.reduce((sum: any, p: any) => sum + p, 0) /
          validPercentages.length;
        console.log(`\n📊 Summary:`);
        console.log(`Total members: ${members.length}`);
        console.log(`Members with valid profiles: ${validMembers.length}`);
        console.log(
          `Members with badge percentage: ${validPercentages.length}`
        );
        console.log(
          `Average positive bulletin board badge percentage: ${avgPercentage.toFixed(
            2
          )}%`
        );
      }
    } else {
      console.log("⚠️ Company not found or no members available");
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(error.response.data.errors, null, 2)
      );
    } else {
      console.error("Failed to fetch company users:", error);
    }
  }
}

console.log("Starting company users fetch process...");
getCompanyUsers(publicCompanyId).catch((err) => {
  console.error("Fatal error in get company users process:", err);
  process.exit(1);
});
