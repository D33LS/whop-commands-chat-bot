import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { CooldownManager } from "@/lib/cooldown";

interface CooldownArgs {
  minutes: number;
  action: "get" | "set";
}

/**
 * Parse the /cooldown command
 * @param raw The raw command string
 * @param mentionedUserIds Array of mentioned user IDs from the message
 * @returns The parsed arguments for the cooldown command
 */
export function parseCooldownCommand(
  raw: string,
  mentionedUserIds: string[] = []
): CooldownArgs {
  const parts = raw.toLowerCase().split(/\s+/);

  if (parts.length < 2) {
    throw new Error("Usage: /cooldown get | /cooldown [minutes] set");
  }

  // Handle "get" action
  if (parts[1] === "get") {
    return { minutes: 0, action: "get" };
  }

  // Handle "set" action
  if (parts.length < 3) {
    throw new Error("Usage: /cooldown get | /cooldown [minutes] set");
  }

  const minutes = parseInt(parts[1], 10);
  const action = parts[2];

  if (isNaN(minutes)) {
    throw new Error("Usage: /cooldown get | /cooldown [minutes] set");
  }

  if (action !== "set") {
    throw new Error("Usage: /cooldown get | /cooldown [minutes] set");
  }

  return { minutes, action };
}

/**
 * Execute the /cooldown command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeCooldownCommand(
  args: CooldownArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const cooldownManager = CooldownManager.getInstance();

  if (!ctx.isAdmin) {
    return {
      success: false,
      message: "Only admins can manage cooldown settings.",
    };
  }

  if (args.action === "get") {
    const cooldownPeriodSeconds = cooldownManager.getCooldownPeriod();
    const cooldownPeriodMinutes = cooldownPeriodSeconds / 60;

    return {
      success: true,
      message: `Chat cooldown period is ${cooldownPeriodMinutes} minute${
        cooldownPeriodMinutes !== 1 ? "s" : ""
      } (${cooldownPeriodSeconds} seconds).`,
    };
  } else {
    const seconds = args.minutes * 60;
    cooldownManager.setCooldownPeriod(seconds);

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `✅ Chat commands cooldown period set to ${args.minutes} minute${
        args.minutes !== 1 ? "s" : ""
      } (${seconds} seconds).`,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: `Chat commands cooldown period set to ${args.minutes} minute${
        args.minutes !== 1 ? "s" : ""
      } (${seconds} seconds).`,
    };
  }
}
