import { CronScheduler } from "@/lib/scheduler/CronScheduler";
import { sendMessage as defaultSendMessage } from "@/lib/whopClient/chatApi";
import { AdminWhitelistManager } from "@/lib/handlers/AdminWhitelistManager";
import {
  COMMANDS,
  STATIC_RESPONSES,
  NEW_COMMAND_RESPONSES,
} from "../../commands";

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  messageSent?: boolean;
  skipWebhook?: boolean;
}

export interface CommandContext {
  userId: string;
  feedId: string;
  feedType: string;
  isAdmin: boolean;
  sendMessage: (opts: {
    feedId: string;
    message: string;
    feedType: string;
  }) => Promise<void>;
}

type SendMessageFn = CommandContext["sendMessage"];

type CommandDefinition<Args> = {
  parse: (raw: string, mentionedUserIds?: string[]) => Args;
  exec: (args: Args, ctx: CommandContext) => Promise<CommandResult>;
  adminOnly?: boolean;
  usage?: string;
  webhookOnFailure?: (
    result: CommandResult,
    ctx: CommandContext,
    args: Args
  ) => Promise<void>;
  // webhookOnSuccess?: boolean;
};

export class CommandHandler {
  private commands = new Map<string, CommandDefinition<any>>();
  private sendMessageFn: SendMessageFn;

  /**
   * @param scheduleRepo
   * @param scheduler
   * @param sendMessageFn
   */
  constructor(
    // private scheduleRepo = ScheduleRepo.getInstance(),
    private scheduler = CronScheduler.getInstance(),
    sendMessageFn?: SendMessageFn
  ) {
    this.sendMessageFn =
      sendMessageFn ??
      (async (opts) => {
        await defaultSendMessage(opts as any);
      });

    for (const [name, definition] of Object.entries(COMMANDS)) {
      this.commands.set(name, definition);
    }

    for (const [cmd, response] of Object.entries(STATIC_RESPONSES)) {
      if (cmd === "new") {
        this.commands.set(cmd, {
          parse: () => ({}),
          exec: this.execNewCommand,
        });
      } else {
        this.commands.set(cmd, {
          parse: () => ({}),
          exec: async (_args: {}, ctx) => {
            await ctx.sendMessage({
              feedId: ctx.feedId,
              message: response,
              feedType: ctx.feedType,
            });
            return { success: true, message: `Sent /${cmd} response.` };
          },
        });
      }
    }
  }

  private async execNewCommand(
    _: {},
    ctx: CommandContext
  ): Promise<CommandResult> {
    const randomIndex = Math.floor(
      Math.random() * NEW_COMMAND_RESPONSES.length
    );
    const randomResponse = NEW_COMMAND_RESPONSES[randomIndex];

    await ctx.sendMessage({
      feedId: ctx.feedId,
      message: randomResponse,
      feedType: ctx.feedType,
    });
    return { success: true, message: "Sent random /new response." };
  }

  /**
   * Main entrypoint
   */
  public async executeCommand(
    raw: string,
    userId: string,
    feedId: string,
    feedType: string,
    isAdmin: boolean,
    mentionedUserIds: string[] = []
  ): Promise<CommandResult> {
    console.log("Command mentioned IDs:", mentionedUserIds);
    if (!raw.startsWith("/")) {
      return { success: false, message: "Commands must start with `/`." };
    }

    const [name] = raw.slice(1).split(/\s+/);
    const def = this.commands.get(name.toLowerCase());
    if (!def) {
      return {
        success: false,
        message: "Unknown command. Type /help for available commands.",
      };
    }

    const adminWhitelistManager = AdminWhitelistManager.getInstance();
    const isAdminWhitelisted = adminWhitelistManager.isAdminWhitelisted(userId);
    const hasAdminPrivileges = isAdmin || isAdminWhitelisted;

    if (def.adminOnly && !hasAdminPrivileges) {
      await this.sendMessageFn({
        feedId,
        feedType,
        message: "This command is restricted to administrators only.",
      });
      return {
        success: false,
        message: "Permission denied: must be an admin to use this command",
        messageSent: true,
      };
    }

    let args;
    try {
      args = def.parse(raw, mentionedUserIds);
    } catch (parseErr: any) {
      const errorMessage = def.usage || parseErr.message || "Usage error";
      await this.sendMessageFn({
        feedId,
        feedType,
        message: errorMessage,
      });
      return {
        success: false,
        message: "Failed to parse command arguments",
        messageSent: true,
      };
    }

    try {
      const ctx = {
        userId,
        feedId,
        feedType,
        isAdmin: hasAdminPrivileges,
        sendMessage: this.sendMessageFn,
      };

      const result = await def.exec(args, ctx);

      if (!result.success && def.webhookOnFailure && !result.skipWebhook) {
        try {
          await def.webhookOnFailure(result, ctx, args);
        } catch (webhookError) {
          console.error(
            `Error in failure webhook for command ${name}:`,
            webhookError
          );
        }
      }

      return result;
    } catch (execErr: any) {
      console.error(`Error executing command ${name}:`, execErr);
      await this.sendMessageFn({
        feedId,
        feedType,
        message: `Error: ${execErr.message || "An unexpected error occurred"}`,
      });
      if (def.webhookOnFailure) {
        try {
          const errorResult = {
            success: false,
            message: execErr.message || "Command execution error",
            messageSent: true,
          };
          await def.webhookOnFailure(
            errorResult,
            {
              userId,
              feedId,
              feedType,
              isAdmin: hasAdminPrivileges,
              sendMessage: this.sendMessageFn,
            },
            args
          );
        } catch (webhookError) {
          console.error(
            `Error in failure webhook for command ${name}:`,
            webhookError
          );
        }
      }

      return {
        success: false,
        message: execErr.message || "An unexpected error occurred",
        messageSent: true,
      };
    }
  }

  /** catch & format any parse or exec errors */
  private async runCommand(fn: () => Promise<CommandResult>) {
    try {
      return await fn();
    } catch (err: any) {
      console.error(err);
      return {
        success: false,
        message: err.message || "Unexpected error during command execution.",
      };
    }
  }
}
