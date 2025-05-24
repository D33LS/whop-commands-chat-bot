import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { AdminWhitelistManager } from "@/lib/handlers/AdminWhitelistManager";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { retryWithBackoff, formatDate } from "@/lib/utils";
import {
  sendAdminUnwhitelistedWebhook,
  sendAdminWhitelistedWebhook,
} from "@/lib/webhooks/ModerationWebhooks";

interface AdminWhitelistArgs {
  userId?: string;
  action: "list" | "add" | "remove";
}

/**
 * Parse the /adminwhitelist command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the adminwhitelist command
 */
export function parseAdminWhitelistCommand(
  raw: string,
  mentionedUserIds: string[] = []
): AdminWhitelistArgs {
  const parts = raw.toLowerCase().split(/\s+/);

  if (parts.length === 1 || parts[1] === "list") {
    return { action: "list" };
  }

  let userId: string | undefined;

  if (
    mentionedUserIds.length > 0 &&
    (parts[1] === "add" || parts[1] === "remove")
  ) {
    userId = mentionedUserIds[0];
    return {
      action: parts[1] === "add" ? "add" : "remove",
      userId,
    };
  } else if (parts.length >= 3) {
    if (parts[1] === "add") {
      userId = parts[2].replace("@", "");
      return { action: "add", userId };
    } else if (parts[1] === "remove") {
      userId = parts[2].replace("@", "");
      return { action: "remove", userId };
    }
  }

  return {
    action:
      parts[1] === "add" ? "add" : parts[1] === "remove" ? "remove" : "list",
    userId,
  };
}

/**
 * Execute the /adminwhitelist command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeAdminWhitelistCommand(
  args: AdminWhitelistArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { userId, action } = args;
  const adminWhitelistManager = AdminWhitelistManager.getInstance();

  let targetUsername = userId || "";
  let targetName = userId || "";
  let createdAt = "Unknown";
  let moderatorUsername = ctx.userId;

  if (userId) {
    try {
      const targetUser = await getUserInfo(userId);
      targetUsername = targetUser.username || userId;
      targetName = targetUser.name || targetUsername;
      if (targetUser.createdAt) {
        createdAt = formatDate(targetUser.createdAt);
      }
    } catch (userError) {
      console.error("Error getting target user info:", userError);
    }
  }

  switch (action) {
    case "list":
      const whitelistedUsers = adminWhitelistManager.getAdminWhitelistedUsers();

      const message =
        whitelistedUsers.length > 0
          ? `Admin-whitelisted user IDs: ${whitelistedUsers.join(", ")}`
          : "No users are currently admin-whitelisted.";

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: "Admin whitelist displayed successfully",
        data: { whitelistedUsers },
        messageSent: true,
      };

    case "add":
      if (!userId) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message: "Please provide a user ID to add to the admin whitelist.",
          feedType: ctx.feedType,
        });

        return {
          success: false,
          message: "No user ID provided",
          messageSent: true,
          skipWebhook: true,
        };
      }

      const alreadyWhitelisted =
        adminWhitelistManager.isAdminWhitelisted(userId);
      if (alreadyWhitelisted) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message: `${targetName} is already on the admin whitelist.`,
          feedType: ctx.feedType,
        });

        return {
          success: true,
          message: `${targetName} already on admin whitelist`,
          data: { userId, action: "already_added" },
          messageSent: true,
        };
      }

      adminWhitelistManager.addToAdminWhitelist(userId);

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `${targetName} was added to the admin whitelist!\nThey can now use admin commands without having the admin badge.`,
        feedType: ctx.feedType,
      });

      await retryWithBackoff(
        () =>
          sendAdminWhitelistedWebhook(
            userId,
            targetUsername,
            ctx.userId,
            moderatorUsername,
            targetName,
            undefined,
            undefined,
            createdAt
          ),
        3,
        500
      );

      return {
        success: true,
        message: `${targetName} added to the admin whitelist`,
        data: { userId, action: "added" },
        messageSent: true,
      };

    case "remove":
      if (!userId) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message:
            "Please provide a user ID to remove from the admin whitelist.",
          feedType: ctx.feedType,
        });

        return {
          success: false,
          message: "No user ID provided",
          messageSent: true,
          skipWebhook: true,
        };
      }

      const removed = adminWhitelistManager.removeFromAdminWhitelist(userId);
      const resultMessage = removed
        ? `${targetName} was removed from the admin whitelist! They can no longer use admin commands.`
        : `${targetName} was not on the admin whitelist.`;

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: resultMessage,
        feedType: ctx.feedType,
      });

      if (removed) {
        await retryWithBackoff(
          () =>
            sendAdminUnwhitelistedWebhook(
              userId,
              targetUsername,
              ctx.userId,
              moderatorUsername,
              targetName,
              undefined,
              undefined,
              createdAt
            ),
          3,
          500
        );
      }

      return {
        success: true,
        message: resultMessage,
        data: { userId, action: "removed", wasRemoved: removed },
        messageSent: true,
      };

    default:
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "Invalid action. Use 'list', 'add', or 'remove'",
        feedType: ctx.feedType,
      });

      return {
        success: false,
        message: "Invalid action. Use 'list', 'add', or 'remove'",
        messageSent: true,
        skipWebhook: true,
      };
  }
}

/**
 * Handle admin whitelist command failures
 */
export async function handleAdminWhitelistFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: AdminWhitelistArgs
): Promise<void> {
  if (result.messageSent || result.skipWebhook) {
    return;
  }

  await ctx
    .sendMessage({
      feedId: ctx.feedId,
      message: `Error managing admin whitelist: ${
        result.message || "Unknown error"
      }`,
      feedType: ctx.feedType,
    })
    .catch((err) =>
      console.error("Error sending admin whitelist error message:", err)
    );

  console.error("Admin whitelist command failed:", result.message);
}
