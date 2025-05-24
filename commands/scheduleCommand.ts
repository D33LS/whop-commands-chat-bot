import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";

interface ScheduleArgs {
  message: string;
  interval: number;
  unit: "m" | "h" | "d";
}

interface ActiveSchedule {
  id: string;
  message: string;
  interval: number;
  unit: string;
  feedId: string;
  feedType: string;
  intervalId: NodeJS.Timeout;
  createdAt: Date;
  userId: string;
}

const activeSchedules = new Map<string, ActiveSchedule>();

/**
 * Parse the /schedule command
 * @param raw The raw command string
 * @returns The parsed arguments for the schedule command
 */
export function parseScheduleCommand(raw: string): ScheduleArgs {
  const msg = raw.match(/"([^"]+)"/)?.[1];
  const sched = raw.match(/every\s+(\d+)([mhd])/i);

  if (!msg || !sched) {
    throw new Error('Usage: schedule "message" every <number>m|h|d');
  }

  const interval = parseInt(sched[1], 10);
  if (interval <= 0) {
    throw new Error("Interval must be > 0");
  }

  return {
    message: msg,
    interval,
    unit: sched[2].toLowerCase() as "m" | "h" | "d",
  };
}

/**
 * Execute the /schedule command
 * @param args The parsed arguments
 * @param ctx The command context
 * @returns The command result
 */
export async function executeScheduleCommand(
  args: ScheduleArgs,
  ctx: CommandContext
): Promise<CommandResult> {
  const { message, interval, unit } = args;

  if (message.length > 500) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: "⚠️ Message too long. Maximum 500 characters allowed.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Message too long",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const existingSchedules = getSchedulesForFeed(ctx.feedId);
  if (existingSchedules.length >= 10) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "⚠️ Maximum 10 schedules per chat. Please stop some existing schedules first.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Too many schedules",
      messageSent: true,
      skipWebhook: true,
    };
  }

  let intervalMs: number;
  let durationText: string;

  switch (unit) {
    case "m":
      intervalMs = interval * 60 * 1000;
      durationText = `${interval} minute${interval === 1 ? "" : "s"}`;
      break;
    case "h":
      intervalMs = interval * 60 * 60 * 1000;
      durationText = `${interval} hour${interval === 1 ? "" : "s"}`;
      break;
    case "d":
      intervalMs = interval * 24 * 60 * 60 * 1000;
      durationText = `${interval} day${interval === 1 ? "" : "s"}`;
      break;
    default:
      throw new Error("Invalid time unit");
  }

  const maxInterval = 7 * 24 * 60 * 60 * 1000;
  if (intervalMs > maxInterval) {
    await ctx.sendMessage({
      feedId: ctx.feedId,
      message:
        "⏱️ Maximum interval is 7 days. Please choose a shorter interval.",
      feedType: ctx.feedType,
    });
    return {
      success: false,
      message: "Interval too large",
      messageSent: true,
      skipWebhook: true,
    };
  }

  const scheduleId = `${ctx.feedId}-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  const intervalId = setInterval(async () => {
    try {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `🔔 ${message}`,
        feedType: ctx.feedType,
      });

      console.log(`Scheduled message sent: "${message}" to feed ${ctx.feedId}`);
    } catch (error) {
      console.error("Error sending scheduled message:", error);

      const schedule = activeSchedules.get(scheduleId);
      if (schedule) {
        clearInterval(schedule.intervalId);
        activeSchedules.delete(scheduleId);
        console.log(`Stopped failing schedule: ${scheduleId}`);
      }
    }
  }, intervalMs);

  const schedule: ActiveSchedule = {
    id: scheduleId,
    message,
    interval,
    unit,
    feedId: ctx.feedId,
    feedType: ctx.feedType,
    intervalId,
    createdAt: new Date(),
    userId: ctx.userId,
  };

  activeSchedules.set(scheduleId, schedule);

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: `✅ Scheduled message "${message}" to repeat every ${durationText}.\n🔧 Use \`/schedule stop\` to stop all schedules in this chat.`,
    feedType: ctx.feedType,
  });

  console.log(
    `Created schedule ${scheduleId}: "${message}" every ${durationText}`
  );

  return {
    success: true,
    message: `Scheduled message every ${durationText}`,
    data: {
      scheduleId,
      message,
      interval,
      unit,
      durationText,
      feedId: ctx.feedId,
      userId: ctx.userId,
    },
    messageSent: true,
  };
}

/**
 * Stop all schedules for a specific feed
 * @param feedId The feed ID to stop schedules for
 * @returns The number of schedules stopped
 */
export function stopSchedulesForFeed(feedId: string): number {
  let stoppedCount = 0;

  for (const [scheduleId, schedule] of activeSchedules.entries()) {
    if (schedule.feedId === feedId) {
      clearInterval(schedule.intervalId);
      activeSchedules.delete(scheduleId);
      stoppedCount++;
      console.log(`Stopped schedule: ${scheduleId}`);
    }
  }

  return stoppedCount;
}

/**
 * Get all active schedules for a feed
 * @param feedId The feed ID to get schedules for
 * @returns Array of active schedules for the feed
 */
export function getSchedulesForFeed(feedId: string): ActiveSchedule[] {
  const schedules: ActiveSchedule[] = [];

  for (const schedule of activeSchedules.values()) {
    if (schedule.feedId === feedId) {
      schedules.push(schedule);
    }
  }

  return schedules;
}

/**
 * Get total number of active schedules across all feeds
 * @returns The total number of active schedules
 */
export function getTotalActiveSchedules(): number {
  return activeSchedules.size;
}

/**
 * Parse and execute schedule management commands (stop, list)
 * @param raw The raw command string
 * @param ctx The command context
 * @returns The command result
 */
export async function executeScheduleManagement(
  raw: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const parts = raw.toLowerCase().split(/\s+/);

  if (parts.length >= 2 && parts[1] === "stop") {
    const stoppedCount = stopSchedulesForFeed(ctx.feedId);

    const message =
      stoppedCount > 0
        ? `🛑 Stopped ${stoppedCount} scheduled message${
            stoppedCount === 1 ? "" : "s"
          } in this chat.`
        : "ℹ️ No scheduled messages found in this chat.";

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message,
      feedType: ctx.feedType,
    });

    return {
      success: true,
      message: `Stopped ${stoppedCount} schedules`,
      data: { stoppedCount },
      messageSent: true,
    };
  }

  if (parts.length >= 2 && parts[1] === "list") {
    const schedules = getSchedulesForFeed(ctx.feedId);

    if (schedules.length === 0) {
      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: "ℹ️ No active scheduled messages in this chat.",
        feedType: ctx.feedType,
      });
    } else {
      const scheduleList = schedules
        .map((schedule, index) => {
          const durationText = `${schedule.interval}${schedule.unit}`;
          const createdTime = schedule.createdAt.toLocaleTimeString();
          return `${index + 1}. "${
            schedule.message
          }" (every ${durationText}, started ${createdTime})`;
        })
        .join("\n");

      await ctx.sendMessage({
        feedId: ctx.feedId,
        message: `📋 Active scheduled messages (${schedules.length}):\n${scheduleList}`,
        feedType: ctx.feedType,
      });
    }

    return {
      success: true,
      message: `Listed ${schedules.length} schedules`,
      data: { schedules: schedules.length },
      messageSent: true,
    };
  }

  const args = parseScheduleCommand(raw);
  return executeScheduleCommand(args, ctx);
}
