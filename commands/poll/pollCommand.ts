import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { PollHandler } from "@/commands/poll/PollHandler";
import { sendPollCreationWebhook } from "./PollWebhooks";
import { v4 as uuidv4 } from "uuid";

interface PollArgs {
  question: string;
  options: string[];
  durationMinutes: number;
}

/**
 * Parse the /poll command
 * @param raw The raw command string
 * @returns The parsed arguments for the poll command
 */
export function parsePollCommand(raw: string): PollArgs {
  let durationMinutes = 5;

  const matches = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  if (!matches || matches.length < 3) {
    throw new Error(
      'Usage: /poll "Question" "Option 1" "Option 2" [duration in minutes]'
    );
  }

  const question = matches[0];
  const options = matches.slice(1);

  const afterLastQuote = raw.substring(raw.lastIndexOf('"') + 1);

  const durationMatch = afterLastQuote.match(/\b(\d+)m?\b/);
  if (durationMatch) {
    durationMinutes = parseInt(durationMatch[1], 10);

    if (durationMinutes < 1) {
      durationMinutes = 1;
    } else if (durationMinutes > 1440) {
      durationMinutes = 1440;
    }
  }

  return {
    question,
    options,
    durationMinutes,
  };
}

/**
 * Execute the /poll command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executePollCommand(
  args: PollArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { question, options, durationMinutes } = args;

  if (!ctx.isAdmin) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "You don't have permission to create polls.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Permission denied: must be an admin to create polls",
    };
  }

  try {

    const pollId = uuidv4().substring(0, 8);
    const optionsWithNumbers = options
      .map((option, index) => `${index + 1}. ${option}`)
      .join("\n");

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `📊 **New Poll by @${
        ctx.userId
      }**\n\n**${question}**\n\n${optionsWithNumbers}\n\nPoll ID: ${pollId}\nDuration: ${durationMinutes} minute${
        durationMinutes === 1 ? "" : "s"
      }\n\nVote using: /vote ${pollId} [option number]`,
      feedType: ctx.feedType,
    });

    const pollOptions = options.map((text, index) => ({
      id: (index + 1).toString(),
      text,
    }));

    const pollHandler = PollHandler.getInstance();
    pollHandler.createPoll(
      pollId,
      question,
      pollOptions,
      ctx.userId,
      ctx.feedId,
      durationMinutes
    );

    try {
      await sendPollCreationWebhook(
        pollId,
        question,
        pollOptions,
        ctx.userId,
        ctx.userId, 
        durationMinutes
      );
      console.log("Poll creation webhook sent successfully");
    } catch (webhookError) {
      console.error("Error sending poll creation webhook:", webhookError);
    }

    return {
      success: true,
      message: `Poll created successfully with ID: ${pollId}`,
      data: {
        pollId,
        question,
        options: pollOptions,
        creatorId: ctx.userId,
        feedId: ctx.feedId,
        durationMinutes,
      },
    };
  } catch (error: any) {
    console.error("Error creating poll:", error);

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: `Error creating poll: ${error.message || "Unknown error"}`,
      feedType: ctx.feedType,
    });

    return {
      success: false,
      message: `Failed to create poll: ${error.message || "Unknown error"}`,
    };
  }
}
