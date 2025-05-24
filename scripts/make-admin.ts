import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.whop.com/public-graphql";
const API_KEY = process.env.WHOP_API_KEY ?? "";
const COMPANY_ID = process.env.WHOP_COMPANY_ID ?? "";
const AGENT_USER_ID = process.env.WHOP_AGENT_USER_ID ?? "";

if (!API_KEY || !COMPANY_ID) {
  console.error("🔑 Please set WHOP_API_KEY and WHOP_COMPANY_ID in your .env");
  process.exit(1);
}

const [, , userId] = process.argv;
if (!userId) {
  console.error("Usage: pnpm run make-admin -- <USER_ID>");
  process.exit(1);
}

interface GraphQLError {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

interface GraphQLResponse {
  data?: {
    addAuthorizedUser?: boolean;
  };
  errors?: GraphQLError[];
}

const mutation = `
mutation AddAuthorizedUser($userId: ID!, $role: AuthorizedUserRoles!) {
  addAuthorizedUser(userId: $userId, role: $role)
}
`;

const variables = {
  userId,
  role: "admin" as const,
};

(async () => {
  try {
    const res = await axios.post<GraphQLResponse>(
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

    if (res.data.errors && res.data.errors.length > 0) {
      console.error("❌ GraphQL errors:", res.data.errors);
      process.exit(1);
    }

    if (res.data.data?.addAuthorizedUser === true) {
      console.log(`🎉 User ${userId} successfully made an admin!`);
    } else {
      console.error("⚠️ Mutation failed: The API returned a false result");
      process.exit(1);
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error("❌ Request failed:", err.response?.data || err.message);
    } else {
      console.error(
        "❌ Unexpected error:",
        err instanceof Error ? err.message : String(err)
      );
    }
    process.exit(1);
  }
})();
