import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.whop.com/public-graphql";
const API_KEY = process.env.WHOP_API_KEY ?? "";
const COMPANY_ID = process.env.WHOP_COMPANY_ID ?? "";
const AGENT_USER_ID = "user_QETsQxWwULkaB";

if (!API_KEY || !COMPANY_ID) {
  console.error("🔑 Please set WHOP_API_KEY and WHOP_COMPANY_ID in your .env");
  process.exit(1);
}

const [, , accessPassId] = process.argv;
if (!accessPassId) {
  console.error("Usage: pnpm run join -- <ACCESS_PASS_ID>");
  process.exit(1);
}

const mutation = `
mutation JoinFreeAccessPass($input: JoinFreeAccessPassInput!) {
  joinFreeAccessPass(input: $input)
}
`;

const variables = {
  input: {
    accessPassId,
    clientMutationId: `join-${Date.now()}`,
    directToConsumer: true,
  },
};

(async () => {
  try {
    const res = await axios.post<{
      data?: { joinFreeAccessPass: boolean };
      errors?: any[];
    }>(
      API_URL,
      { query: mutation, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "x-on-behalf-of": AGENT_USER_ID,
          "x-company-id": COMPANY_ID,
        },
      }
    );

    if (res.data.errors) {
      console.error("❌ GraphQL errors:", res.data.errors);
      process.exit(1);
    }

    if (res.data.data?.joinFreeAccessPass) {
      console.log("🎉 User successfully joined the access pass!");
    } else {
      console.error(
        "⚠️  Mutation returned false. User may already have joined or an unknown issue occurred."
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Request failed:", err.response?.data || err.message);
    process.exit(1);
  }
})();
