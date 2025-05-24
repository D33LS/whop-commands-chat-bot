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
  console.error('Usage: ts-node scripts/ban-user-debug.ts "user_id_to_ban"');
  process.exit(1);
}

console.log(`Banning user ${targetUserId}`);
console.log(`Company ID: ${COMPANY_ID}`);
console.log(`Using Auth User: ${CHAT_USER_ID}`);

const BAN_USER_MUTATION = `
  mutation BanUser($input: BanUserInput!) {
    banUser(input: $input)
  }
`;

async function banUser(userId: string) {
  try {
    const variables = {
      input: {
        userId: userId,
        reason: "spamming",
      },
    };

    // console.log("Request data:", JSON.stringify(variables, null, 2));

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: BAN_USER_MUTATION,
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

    // console.log("Response status:", response.status);
    // console.log("Response data:", JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(response.data.errors, null, 2)
      );
      return;
    }

    console.log("✅ User banned successfully");
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(error.response.data.errors, null, 2)
      );
    } else {
      console.error("Failed to ban user");
    }
  }
}
console.log("Starting user ban process...");
banUser(targetUserId).catch((err) => {
  console.error("Fatal error in ban process:", err);
  process.exit(1);
});
