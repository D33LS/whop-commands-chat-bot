import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.whop.com/public-graphql";
const API_KEY = process.env.WHOP_API_KEY ?? "";
const COMPANY_ID = process.env.WHOP_COMPANY_ID ?? "";
const AGENT_USER_ID = process.env.WHOP_AGENT_USER_ID ?? "";

if (!API_KEY || !COMPANY_ID || !AGENT_USER_ID) {
  console.error(
    "🔑 Please set WHOP_API_KEY, WHOP_COMPANY_ID, and WHOP_AGENT_USER_ID in your .env"
  );
  process.exit(1);
}

const [, , accessPassId, userId] = process.argv;
if (!accessPassId || !userId) {
  console.error("Usage: pnpm run invite -- <ACCESS_PASS_ID> <USER_ID>");
  process.exit(1);
}

const mutation = `
mutation InviteUserToAccessPass($input: InviteUserToAccessPassInput!) {
  inviteUserToAccessPass(input: $input)
}
`;

const variables = {
  input: {
    accessPassId,
    userId,
    clientMutationId: `invite-${Date.now()}`,
  },
};

(async () => {
  try {
    const res = await axios.post<{
      data?: { inviteUserToAccessPass: boolean };
      errors?: any[];
    }>(
      API_URL,
      { query: mutation, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "x-company-id": COMPANY_ID,
          "x-on-behalf-of": AGENT_USER_ID,
        },
      }
    );

    if (res.data.errors) {
      console.error("❌ GraphQL errors:", res.data.errors);
      process.exit(1);
    }

    if (res.data.data?.inviteUserToAccessPass) {
      console.log("🎉 User successfully invited to access pass!");
      console.log(`✅ Invited user ${userId} to access pass ${accessPassId}`);
    } else {
      console.error(
        "⚠️  Mutation returned false. User may already be invited/have access or an unknown issue occurred."
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Request failed:", err.response?.data || err.message);
    process.exit(1);
  }
})();
