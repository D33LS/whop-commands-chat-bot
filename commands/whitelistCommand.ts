import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { CooldownManager } from "@/lib/cooldown";
import { getUserInfo } from "@/lib/whopClient/userApi";
import { logInfo } from "@/lib/webhooks/LogWebhooks";
import {
  sendUnwhitelistedWebhook,
  sendWhitelistedWebhook,
} from "@/lib/webhooks/ModerationWebhooks";
import { formatDate } from "@/lib/utils";

interface WhitelistArgs {
  userId?: string;
  action: "list" | "add" | "remove";
}

/**
 * Parse the /whitelist command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the whitelist command
 */
export function parseWhitelistCommand(
  raw: string,
  mentionedUserIds: string[] = []
): WhitelistArgs {
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
 * Execute the /whitelist command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeWhitelistCommand(
  args: WhitelistArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { userId, action } = args;
  const cooldownManager = CooldownManager.getInstance();

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
      const whitelistedUsers = cooldownManager.getWhitelistedUsers();

      const message =
        whitelistedUsers.length > 0
          ? `📝 Cooldown whitelist:\n${whitelistedUsers
              .map((id) => `<@${id}>`)
              .join(", ")}`
          : "🚫 No users are currently whitelisted.";

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message,
        feedType: ctx.feedType,
      });

      return {
        success: true,
        message: "Whitelist displayed successfully",
        data: { whitelistedUsers },
        messageSent: true,
      };

    case "add":
      if (!userId) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message: "✋ Who should I whitelist? Please provide a user to add.",
          feedType: ctx.feedType,
        });

        return {
          success: false,
          message: "No user ID provided",
          messageSent: true,
          skipWebhook: true,
        };
      }

      const isAlreadyWhitelisted = cooldownManager
        .getWhitelistedUsers()
        .includes(userId);
      if (isAlreadyWhitelisted) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message: `ℹ️ ${userId} is already whitelisted.`,
          feedType: ctx.feedType,
        });

        return {
          success: true,
          message: `User ${userId} already on cooldown whitelist`,
          data: { userId, action: "already_added" },
          messageSent: true,
        };
      }

      cooldownManager.addToWhitelist(userId);

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `User ${userId} added to the cooldown whitelist.`,
        feedType: ctx.feedType,
      });

      try {
        await sendWhitelistedWebhook(
          userId,
          targetUsername,
          ctx.userId,
          moderatorUsername,
          targetName,
          undefined,
          undefined,
          createdAt
        );
      } catch (webhookError) {
        console.error("Error sending whitelist webhook:", webhookError);
      }

      return {
        success: true,
        message: `User ${userId} added to the cooldown whitelist`,
        data: { userId, action: "added" },
        messageSent: true,
      };

    case "remove":
      if (!userId) {
        await ctx.sendMessage({
          feedId: ctx.feedId,
          message: "✂️ Who should I remove? Please provide a user to remove.",
          feedType: ctx.feedType,
        });

        return {
          success: false,
          message: "No user ID provided",
          messageSent: true,
          skipWebhook: true,
        };
      }

      const removed = cooldownManager.removeFromWhitelist(userId);

      if (removed) {
        try {
          await sendUnwhitelistedWebhook(
            userId,
            targetUsername,
            ctx.userId,
            moderatorUsername,
            targetName,
            undefined,
            undefined,
            createdAt
          );
        } catch (webhookError) {
          console.error("Error sending unwhitelist webhook:", webhookError);
        }
      }

      const resultMessage = removed
        ? `✅ ${userId} has been removed from the cooldown whitelist.`
        : `ℹ️ ${userId} wasn't on cooldown whitelist.`;

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: resultMessage,
        feedType: ctx.feedType,
      });

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
 * Handle whitelist command failures
 */
export async function handleWhitelistFailure(
  result: CommandResult,
  ctx: CommandContext,
  args: WhitelistArgs
): Promise<void> {
  if (result.messageSent || result.skipWebhook) {
    return;
  }

  try {
    await logInfo("Error Managing Whitelist", result.message, {
      userId: args.userId,
      error: result.message,
    });
  } catch (logErr) {
    console.error("Error sending webhook logging:", logErr);
  }

  console.error("Whitelist command failed:", result.message);
}
