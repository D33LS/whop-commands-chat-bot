import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { sendMessage, createDmChannel } from "@/lib/whopClient/chatApi";
import { FeedTypes } from "@/lib/whopClient/graphql/types";

interface RemindMeArgs {
  message: string;
  duration: number;
  durationText: string;
  error?: string;
}

/**
 * Parse the /remindme command
 * @param raw The raw command string
 * @returns The parsed arguments for the remindme command
 */
export function parseRemindMeCommand(raw: string): RemindMeArgs {
  const timeMatch = raw.match(/\s+in\s+(\d+)\s*([mdwh])\s*$/i);

  if (!timeMatch) {
    return {
      message: "",
      duration: 0,
      durationText: "",
    };
  }

  const value = parseInt(timeMatch[1], 10);
  const unit = timeMatch[2].toLowerCase();

  let durationInSeconds: number;
  let durationText: string;
  switch (unit) {
    case "m":
      durationInSeconds = value * 60;
      durationText = `${value} minute${value === 1 ? "" : "s"}`;
      break;
    case "h":
      durationInSeconds = value * 3600;
      durationText = `${value} hour${value === 1 ? "" : "s"}`;
      break;
    case "d":
      durationInSeconds = value * 86400;
      durationText = `${value} day${value === 1 ? "" : "s"}`;
      break;
    case "w":
      durationInSeconds = value * 604800;
      durationText = `${value} week${value === 1 ? "" : "s"}`;
      break;
    default:
      durationInSeconds = value * 60;
      durationText = `${value} minute${value === 1 ? "" : "s"}`;
  }

  if (durationInSeconds > 2147483) {
    return {
      message: "",
      duration: 0,
      durationText: "",
    };
  }

  const fullCommand = raw.trim();
  const messageText = fullCommand
    .substring("/remindme".length, fullCommand.lastIndexOf(" in "))
    .trim();

  return {
    message: messageText,
    duration: durationInSeconds,
    durationText,
  };
}

/**
 * Execute the /remindme command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeRemindMeCommand(
  args: RemindMeArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { message, duration, durationText } = args;

  if (!duration) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "❓ I didn't catch the time. Try: /remindme [what] in [number][m|h|d|w] (/remindme call Eric in 10m)",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Invalid time format",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (duration > 2147483) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "⏱️ That's a bit too far out! Please pick a shorter time frame",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Duration too large",
      messageSent: true,
      skipWebhook: true,
    };
  }

  if (!message) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "✏️ Oops—you didn't tell me what to remind you about. What should I remind you to do?",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Reminder text missing",
      messageSent: true,
      skipWebhook: true,
    };
  }

  setTimeout(async () => {
    try {
      const dmFeedId = await createDmChannel(ctx.userId);

      await sendMessage({
        feedId: dmFeedId,
        message: `🔔 **Reminder:** ${message}`,
        feedType: "dms_feed" as FeedTypes,
      });

      console.log(`Reminder sent to user ${ctx.userId} in DM ${dmFeedId}`);
    } catch (reminderError) {
      console.error("Error sending reminder:", reminderError);
    }
  }, duration * 1000);

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: `✅ I'll remind you "${message}" in ${durationText}.`,
    feedType: ctx.feedType,
  });

  return {
    success: true,
    message: `Reminder set for ${durationText} from now`,
    data: {
      userId: ctx.userId,
      message,
      duration,
      durationText,
      scheduledTime: new Date(Date.now() + duration * 1000).toISOString(),
    },
    messageSent: true,
  };
}
