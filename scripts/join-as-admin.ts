import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.whop.com/public-graphql";
const API_KEY = process.env.WHOP_API_KEY ?? "";
const COMPANY_ID = process.env.WHOP_COMPANY_ID ?? "";

if (!API_KEY || !COMPANY_ID) {
  console.error("🔑 Please set WHOP_API_KEY and WHOP_COMPANY_ID in your .env");
  process.exit(1);
}

const [, , agentUserId] = process.argv;
if (!agentUserId) {
  console.error("Usage: pnpm run add-admin -- <AGENT_USER_ID>");
  process.exit(1);
}

const mutation = `
mutation AddAgentUserTeamMember($input: AddAgentUserTeamMemberInput!) {
  addAgentUserTeamMember(input: $input)
}
`;

const variables = {
  input: {
    agentUserId,
    companyId: COMPANY_ID,
    clientMutationId: `add-admin-${Date.now()}`,
  },
};

(async () => {
  try {
    const res = await axios.post<{
      data?: { addAgentUserTeamMember: boolean };
      errors?: any[];
    }>(
      API_URL,
      { query: mutation, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "x-company-id": COMPANY_ID,
        },
      }
    );

    if (res.data.errors) {
      console.error("❌ GraphQL errors:", res.data.errors);
      process.exit(1);
    }

    if (res.data.data?.addAgentUserTeamMember) {
      console.log("🎉 User successfully added as team member/admin!");
      console.log(`✅ Added user ${agentUserId} to company ${COMPANY_ID}`);
    } else {
      console.error(
        "⚠️  Mutation returned false. User may already be a team member or an unknown issue occurred."
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Request failed:", err.response?.data || err.message);
    process.exit(1);
  }
})();
