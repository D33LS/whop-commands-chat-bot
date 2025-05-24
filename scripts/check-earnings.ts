import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["WHOP_API_KEY", "WHOP_USER_ID", "WHOP_COMPANY_ID"];
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
  console.error('Usage: ts-node scripts/check-earnings.ts "user_id_to_fetch"');
  process.exit(1);
}

console.log(`Fetching earnings for user ${targetUserId}`);
console.log(`Company ID: ${COMPANY_ID}`);
console.log(`Using Auth User: ${CHAT_USER_ID}`);

// Modified query based on API error messages
const GET_EARNINGS_QUERY = `
  query {
    publicUser(id: "${targetUserId}") {
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

async function getEarnings(userId: string) {
  try {
    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: GET_EARNINGS_QUERY,
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
    if (!user) {
      console.log("⚠️ User not found");
      return;
    }

    const reports = user.earningsReports?.nodes;
    if (reports && reports.length > 0) {
      console.log(
        `✅ Found ${reports.length} earnings reports for user ${user.username}:`
      );
      console.log(JSON.stringify(reports, null, 2));
    } else {
      console.log(`⚠️ No earnings reports found for user ${user.username}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(error.response.data.errors, null, 2)
      );
    } else {
      console.error("Failed to fetch earnings reports:", error);
    }
  }
}

console.log("Starting earnings fetch process...");
getEarnings(targetUserId).catch((err) => {
  console.error("Fatal error in get earnings process:", err);
  process.exit(1);
});
