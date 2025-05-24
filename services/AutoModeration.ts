// import { ApolloGraphQLClient } from "@/lib/whopClient/ApolloGraphQLClient";
// import { Violation } from "@/modules/autoModeration/domain/Violation";
// import { IViolationRepository } from "@/lib/database/repositories/ViolationRepo";

// interface BanUserResponse {
//   banUser: boolean;
// }

// interface NegativeBadgesResponse {
//   publicUsers: Array<{
//     negativeBulletinBoardBadges: {
//       count: number;
//     };
//   }>;
// }

// export class AutoModService {
//   //set amount of negative badges to trigger ban
//   private readonly NEGATIVE_BADGES_THRESHOLD = 1;
//   private readonly CHAT_WEBHOOK_URL = process.env.WHOP_CHAT_WEBHOOK_URL;

//   constructor(
//     private graphQLClient: ApolloGraphQLClient,
//     private violationRepo: IViolationRepository
//   ) {}

//   async processUser(userId: string, companyId: string): Promise<boolean> {
//     try {
//       // 1. Check if user already has a violation record
//       const existingViolation = await this.violationRepo.findByUserId(userId);
//       if (existingViolation && existingViolation.banned) {
//         console.log(`User ${userId} already banned, skipping check`);
//         return false;
//       }

//       // 2. Fetch negative bulletin board badges count
//       console.log(`Fetching negative badges for user ${userId}`);
//       const badgesResponse = await this.fetchNegativeBadgesCount(
//         userId,
//         companyId
//       );
//       console.log(`Badges response:`, badgesResponse);

//       const badgesCount = this.getNegativeBadgesCount(badgesResponse);
//       console.log(`User ${userId} has ${badgesCount} negative bulletin badges`);

//       // 3. If count is at or above threshold, ban the user
//       if (badgesCount >= this.NEGATIVE_BADGES_THRESHOLD) {
//         await this.banUser(userId, companyId, badgesCount);
//         await this.recordViolation(userId, badgesCount);
//         return true;
//       }

//       // 4. Record the current violation count for future checks
//       await this.recordViolation(userId, badgesCount, false);
//       return false;
//     } catch (error) {
//       console.error(
//         `Error processing auto-moderation for user ${userId}:`,
//         error
//       );
//       throw error;
//     }
//   }

//   private async fetchNegativeBadgesCount(
//     userId: string,
//     companyId: string
//   ): Promise<NegativeBadgesResponse> {
//     const apiKey = process.env.WHOP_API_KEY || "";
//     const authorizedUserId = process.env.WHOP_AUTHORIZED_USER_ID || "";

//     if (!apiKey) {
//       throw new Error("WHOP_API_KEY environment variable is not set");
//     }

//     if (!authorizedUserId) {
//       throw new Error(
//         "WHOP_AUTHORIZED_USER_ID environment variable is not set"
//       );
//     }

//     const query = `
//       query NegativeBulletinBoardBadges($ids: [ID!]!) {
//         publicUsers(ids: $ids) {
//           negativeBulletinBoardBadges {
//             count
//           }
//         }
//       }
//     `;

//     const variables = {
//       ids: [userId],
//     };

//     return await this.graphQLClient.callGraphQL<NegativeBadgesResponse>({
//       query,
//       variables,
//       apiKey,
//       userId,
//       authorizedUserId,
//       companyId,
//     });
//   }

//   private getNegativeBadgesCount(response: NegativeBadgesResponse): number {
//     if (
//       !response.publicUsers ||
//       response.publicUsers.length === 0 ||
//       !response.publicUsers[0].negativeBulletinBoardBadges
//     ) {
//       return 0;
//     }

//     const badgesArray = response.publicUsers[0].negativeBulletinBoardBadges;
//     if (Array.isArray(badgesArray)) {
//       return badgesArray.reduce(
//         (total, badge) => total + (badge.count || 0),
//         0
//       );
//     }

//     if (
//       typeof response.publicUsers[0].negativeBulletinBoardBadges.count ===
//       "number"
//     ) {
//       return response.publicUsers[0].negativeBulletinBoardBadges.count;
//     }
//     return 0;
//   }

//   private async banUser(
//     userId: string,
//     companyId: string,
//     badgesCount: number
//   ): Promise<boolean> {
//     const apiKey = process.env.WHOP_API_KEY || "";
//     // Use the ban-specific authorized user ID for this operation
//     const authorizedUserId = process.env.WHOP_BAN_AUTHORIZED_USER_ID;

//     if (!apiKey) {
//       throw new Error("WHOP_API_KEY environment variable is not set");
//     }

//     if (!authorizedUserId) {
//       throw new Error("No authorized user ID available for banning");
//     }

//     console.log(
//       `Attempting to ban user ${userId} using authorized user ${authorizedUserId}`
//     );

//     const mutation = `
//       mutation BanUser($input: BanUserInput!) {
//         banUser(input: $input)
//       }
//     `;

//     const variables = {
//       input: {
//         userId,
//         reason: "other",
//       },
//     };

//     // Log what we're sending for debugging
//     console.log(`Ban request variables: ${JSON.stringify(variables)}`);

//     const response = await this.graphQLClient.callGraphQL<BanUserResponse>({
//       query: mutation,
//       variables,
//       apiKey,
//       userId,
//       authorizedUserId,
//       companyId,
//     });

//     if (response.banUser) {
//       console.log(`Successfully banned user ${userId}`);
//       await this.sendBanWebhook(userId, badgesCount);
//       return true;
//     } else {
//       console.error(`Failed to ban user ${userId}`);
//       return false;
//     }
//   }

//   private async recordViolation(
//     userId: string,
//     badgesCount: number,
//     banned: boolean = true
//   ): Promise<void> {
//     const violation = new Violation(userId, badgesCount, banned, new Date());

//     await this.violationRepo.saveOrUpdate(violation);
//   }

//   private async sendBanWebhook(
//     userId: string,
//     badgesCount: number
//   ): Promise<void> {
//     if (!this.CHAT_WEBHOOK_URL) {
//       console.warn(
//         "WHOP_CHAT_WEBHOOK_URL not set, skipping webhook notification"
//       );
//       return;
//     }

//     try {
//       // Format timestamp for display
//       const timestamp = new Date().toISOString();
//       const displayTimestamp = new Date().toLocaleString("en-US", {
//         month: "short",
//         day: "numeric",
//         year: "numeric",
//         hour: "numeric",
//         minute: "2-digit",
//         hour12: true,
//       });

//       // Create payload for Whop Chat
//       const payload = {
//         content: `User ${userId} has been automatically banned ❌`,
//         embeds: [
//           {
//             title: "Automatic User Ban",
//             color: 16711680, // Red color
//             url: "https://whop.com",
//             description: `A user has been automatically banned due to ${badgesCount} negative badges.`,
//             timestamp,
//             fields: [
//               {
//                 name: "User ID",
//                 value: userId,
//                 inline: true,
//               },
//               {
//                 name: "Negative Badges",
//                 value: badgesCount.toString(),
//                 inline: true,
//               },
//               {
//                 name: "Ban Reason",
//                 value: `Automatic ban threshold (${this.NEGATIVE_BADGES_THRESHOLD}+ badges) reached`,
//                 inline: false,
//               },
//             ],
//             footer: {
//               text: `Auto-Moderation System • ${displayTimestamp}`,
//               icon_url: "https://imgur.com/IjL0T1y.png",
//             },
//           },
//         ],
//       };

//       const headers: Record<string, string> = {
//         "Content-Type": "application/json",
//       };

//       if (process.env.WHOP_API_KEY) {
//         headers["Authorization"] = `Bearer ${process.env.WHOP_API_KEY}`;
//       }

//       const response = await fetch(this.CHAT_WEBHOOK_URL, {
//         method: "POST",
//         headers,
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok && response.status !== 204) {
//         throw new Error(
//           `Failed to send ban webhook: ${
//             response.status
//           } - ${await response.text()}`
//         );
//       }

//       console.log("Ban notification webhook sent successfully");
//     } catch (error) {
//       console.error("Error sending ban notification webhook:", error);
//     }
//   }
// }
