import { LivestreamHandler } from "@/lib/handlers/LivestreamHandler";
import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";

/**
 * Parse the /newlive command
 * @param raw The raw command string
 * @returns The parsed message
 */
export function parseNewLiveCommand(raw: string): { message: string } {
  let msg = raw.match(/"([^"]+)"/)?.[1];

  if (!msg) {
    const parts = raw.split(/\s+/);
    if (parts.length > 1) {
      msg = parts.slice(1).join(" ");
    }
  }

  if (!msg || msg.trim() === "") {
    throw new Error(
      'Usage: /newlive "Your welcome message" or /newlive Your welcome message'
    );
  }

  return { message: msg };
}

/**
 * Execute the /newlive command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeNewLiveCommand(
  { message }: { message: string },
  ctx: CommandContext
): Promise<CommandResult> {
  const livestreamHandler = LivestreamHandler.getInstance();

  livestreamHandler.setLiveMessage(ctx.userId, message);

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: `✅ Your livestream welcome message has been set to: "${message}"`,
    feedType: ctx.feedType,
  });

  return {
    success: true,
    message: `Livestream welcome message set for user ${ctx.userId}`,
    data: { userId: ctx.userId, message },
  };
}
