import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.WHOP_API_KEY;
const CHAT_USER_ID = process.env.WHOP_ADMIN_USER_ID;
const COMPANY_ID = process.env.WHOP_COMPANY_ID;

// Get command line arguments: user ID and optional mute duration in hours
const [, , targetUserId, muteDurationHours = "24"] = process.argv;
if (!targetUserId) {
  console.error(
    'Usage: ts-node scripts/mute-user.ts "user_id_to_mute" [duration_in_hours]'
  );
  process.exit(1);
}

// Calculate mute timestamp (default: 24 hours from now)
const hoursToMute = parseInt(muteDurationHours, 10);
const mutedUntil = new Date(
  Date.now() + hoursToMute * 60 * 60 * 1000
).toISOString();

console.log(`Muting user ${targetUserId} until ${mutedUntil}`);
console.log(`Company ID: ${COMPANY_ID}`);
console.log(`Using Auth User: ${CHAT_USER_ID}`);

const MUTE_USER_MUTATION = `
  mutation MuteUser($input: CreateCompanyMutedUserInput!) {
    createCompanyMutedUser(input: $input) {
      clientMutationId
    }
  }
`;

async function muteUser(userId: string, mutedUntil: string) {
  try {
    const variables = {
      input: {
        userId: userId,
        mutedUntil: mutedUntil,
      },
    };

    const response = await axios.post(
      "https://api.whop.com/public-graphql",
      {
        query: MUTE_USER_MUTATION,
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

    console.log("✅ User muted successfully until", mutedUntil);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      console.error(
        "GraphQL errors:",
        JSON.stringify(error.response.data.errors, null, 2)
      );
    } else {
      console.error("Failed to mute user");
      console.error(error);
    }
  }
}

console.log("Starting user mute process...");
muteUser(targetUserId, mutedUntil).catch((err) => {
  console.error("Fatal error in mute process:", err);
  process.exit(1);
});
