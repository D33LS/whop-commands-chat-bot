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

const [, , targetUserId] = process.argv;
if (!targetUserId) {
  console.error('Usage: ts-node scripts/get-user-debug.ts "user_id_to_fetch"');
  process.exit(1);
}

console.log(`Fetching user ${targetUserId}`);
console.log(`Company ID: ${COMPANY_ID}`);
console.log(`Using Auth User: ${CHAT_USER_ID}`);

const GET_USER_QUERY = `
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

async function getUser(userId: string) {
  try {
    const variables = {
      id: userId,
    };

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: GET_USER_QUERY,
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

    const user = response.data.data.publicUser;
    if (user) {
      console.log("✅ User found:");
      console.log(JSON.stringify(user, null, 2));
    } else {
      console.log("⚠️ User not found");
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(error.response.data.errors, null, 2)
      );
    } else {
      console.error("Failed to fetch user");
    }
  }
}

console.log("Starting user fetch process...");
getUser(targetUserId).catch((err) => {
  console.error("Fatal error in get user process:", err);
  process.exit(1);
});
