import WebSocket from "ws";
import { EventEmitter } from "events";
import { sendMessage } from "../whopClient/chatApi";
// import { createClient } from "@supabase/supabase-js";
import { CommandHandler } from "@/lib/handlers/CommandHandler";
import { CooldownManager } from "../cooldown";
import { LivestreamHandler } from "../handlers/LivestreamHandler";

export enum ChatEventType {
  MESSAGE_RECEIVED = "message:received",
  COMMAND_RECEIVED = "command:received",
  COMMAND_PROCESSED = "command:processed",
  USER_JOINED = "user:joined",
  FIRST_TIME_POSTER = "user:first_time_poster",
  LIVESTREAM_STARTED = "livestream:started",
  CONNECTION_OPENED = "connection:opened",
  CONNECTION_CLOSED = "connection:closed",
  CONNECTION_ERROR = "connection:error",
}

export interface ChatMessage {
  id: string;
  feedId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  isFirstTimePost?: boolean;
  isPosterAdmin?: boolean;
  isCommand?: boolean;
  feedType?: string;
  mentionedUserIds?: string[];
}

export interface LivestreamEvent {
  feedId: string;
  hostId: string;
  experienceId: string;
  title?: string;
  startedAt: Date;
}

/**
 * WebSocket listener for chat events
 */
export class ChatWsListener extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  // private supabase;
  private commandHandler: CommandHandler;
  private livestreamHandler: LivestreamHandler;
  private static instance: ChatWsListener;
  private processedMessageIds = new Set<string>();
  private processedLivestreamIds = new Set<string>();
  private cooldownManager: CooldownManager;
  private validCommands: Set<string>;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();

    console.log("ChatWsListener constructor called");
    console.log("Initializing CommandHandler...");

    // this.supabase = createClient(
    //   process.env.SUPABASE_URL!,
    //   process.env.SUPABASE_KEY!
    // );

    const cooldownSeconds = parseInt(
      process.env.WHOP_CHAT_COOLDOWN_SECONDS || "10",
      10
    );
    const cooldownNoticeMinutes = parseInt(
      process.env.WHOP_CHAT_COOLDOWN_NOTICE_MINUTES || "5",
      10
    );
    this.cooldownManager = CooldownManager.getInstance(
      cooldownSeconds,
      [],
      cooldownNoticeMinutes
    );
    this.commandHandler = new CommandHandler();
    this.livestreamHandler = LivestreamHandler.getInstance();
    this.validCommands = this.getValidCommands();

    console.log("Valid commands:", [...this.validCommands]);
    console.log("CommandHandler and LivestreamHandler initialized");
  }

  /**
   * Get the singleton instance of ChatWsListener
   */
  public static getInstance(): ChatWsListener {
    if (!ChatWsListener.instance) {
      ChatWsListener.instance = new ChatWsListener();
    }
    return ChatWsListener.instance;
  }

  /**
   * Get all valid commands registered in the CommandHandler
   */
  private getValidCommands(): Set<string> {
    const staticCommands = Object.keys(
      require("../../commands/staticCommands").STATIC_RESPONSES
    );

    const dynamicCommands = [
      "schedule",
      "announce",
      "help",
      "startpromo",
      "poll",
      "remindme",
      "newlive",
      "mute",
      "unmute",
      "ban",
      "unban",
      "transcript",
      "cooldown",
      "adminwhitelist",
      "whitelist",
      "contentrewards",
      "earnings",
      "kick",
      "purge",
      "referrals",
      "scan",
      "addfreedays",
      "affiliatelink",
    ];

    return new Set([...staticCommands, ...dynamicCommands]);
  }

  /**
   * Check if a command is valid
   * @param content The message content
   * @returns Whether the command is valid
   */
  private isValidCommand(content: string): boolean {
    if (!content.startsWith("/")) return false;
    const commandName = content.substring(1).split(/\s+/)[0].toLowerCase();

    return this.validCommands.has(commandName);
  }

  /**
   * Connect to the Whop WebSocket server
   */
  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    const apiKey = process.env.WHOP_API_KEY;
    const agentUserId = process.env.WHOP_ADMIN_USER_ID;

    if (!apiKey || !agentUserId) {
      throw new Error(
        "Missing required environment variables: WHOP_API_KEY, WHOP_ADMIN_USER_ID"
      );
    }

    this.ws = new WebSocket("wss://ws-prod.whop.com/ws/developer", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-on-behalf-of": agentUserId,
      },
    });

    this.ws.on("open", this.handleOpen.bind(this));
    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("close", this.handleClose.bind(this));
    this.ws.on("error", this.handleError.bind(this));

    console.log("WebSocket connection initiated");
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("WebSocket connection established");
    this.reconnectAttempts = 0;
    this.emit(ChatEventType.CONNECTION_OPENED);
  }

  /**
   * Handle WebSocket message event
   * @param data The raw message data
   */

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      // messages we don't care about
      if (
        message.goFetchNotifications ||
        message.marketplaceStats ||
        message.experiencePreviewContent ||
        message.channelSubscriptionState ||
        message.accessPassMember ||
        message.broadcastResponse?.typingIndicator ||
        message.feedEntity?.postReactionCountUpdate
        // message.feedEntity?.dmsPost
        // message.experience
        // message.feedEntity?.broadcastResponse?.typingIndicator
      ) {
        return Promise.resolve();
      }

      console.log(
        "Received WebSocket message:",
        JSON.stringify(message, null, 2)
      );

      if (message.feedEntity?.livestreamFeed) {
        const livestream = message.feedEntity.livestreamFeed;
        await this.handleLivestreamEvent(livestream);
        return Promise.resolve();
      }

      if (message.feedEntity?.dmsPost) {
        const post = message.feedEntity.dmsPost;

        if (this.processedMessageIds.has(post.entityId)) {
          console.log(`Skipping already processed message: ${post.entityId}`);
          return Promise.resolve();
        }

        this.processedMessageIds.add(post.entityId);
        if (this.processedMessageIds.size > 1000) {
          const idsArray = Array.from(this.processedMessageIds);
          this.processedMessageIds = new Set(
            idsArray.slice(idsArray.length - 500)
          );
        }

        const chatMessage: ChatMessage = {
          id: post.entityId,
          feedId: post.feedId,
          userId: post.userId,
          username: post.user.username,
          content: post.content,
          timestamp: new Date(parseInt(post.createdAt)),
          isCommand: post.content.startsWith("/"),
          isPosterAdmin: post.isPosterAdmin,
          feedType: post.feedType,
        };

        this.emit(ChatEventType.MESSAGE_RECEIVED, chatMessage);

        if (chatMessage.isCommand) {
          const isValid = this.isValidCommand(chatMessage.content);

          if (isValid) {
            this.emit(ChatEventType.COMMAND_RECEIVED, chatMessage);
            const isWhitelisted = this.cooldownManager.isWhitelisted(
              chatMessage.userId
            );
            const cooldownCheck = this.cooldownManager.checkCooldown(
              chatMessage.userId,
              chatMessage.isPosterAdmin || isWhitelisted || false
            );

            if (cooldownCheck.isOnCooldown) {
              try {
                await sendMessage({
                  feedId: chatMessage.feedId,
                  message: `Please wait ${cooldownCheck.formattedTime} more seconds before sending another command.`,
                  feedType: chatMessage.feedType,
                } as any);
              } catch (error) {
                console.error("Error sending cooldown message:", error);
              }
            } else {
              this.cooldownManager.recordMessage(chatMessage.userId);
              chatMessage.mentionedUserIds = post.mentionedUserIds || [];
              await this.processCommand(chatMessage);
            }
          } else {
            console.log(`Ignored invalid command: ${chatMessage.content}`);
          }
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }

  /**
   * Process a command from a chat message
   * @param message The chat message containing a command
   */
  private async processCommand(message: ChatMessage): Promise<void> {
    console.log("Processing command:", message.content);
    try {
      if (!this.commandHandler) {
        console.error("CommandHandler is not initialized!");
        return;
      }

      const mentionedUserIds = message.mentionedUserIds || [];
      const result = await this.commandHandler.executeCommand(
        message.content,
        message.userId,
        message.feedId,
        message.feedType || "chat_feed",
        message.isPosterAdmin || false,
        mentionedUserIds
      );

      this.emit(ChatEventType.COMMAND_PROCESSED, {
        message,
        result,
      });
    } catch (error) {
      console.error("Error processing command:", error);
    }
  }

  /**
   * Handle WebSocket close event
   * @param code The close code
   * @param reason The reason for closing
   */
  private handleClose(code: number, reason: string): void {
    console.log(`WebSocket connection closed: ${code} - ${reason}`);
    this.emit(ChatEventType.CONNECTION_CLOSED, { code, reason });
    this.attemptReconnect();
  }

  /**
   * Handle WebSocket error event
   * @param error The error
   */
  private handleError(error: Error): void {
    console.error("WebSocket error:", error);
    this.emit(ChatEventType.CONNECTION_ERROR, error);
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Handle a livestream event
   * @param livestream The livestream data from the WebSocket
   */
  private async handleLivestreamEvent(livestream: any): Promise<void> {
    try {
      if (this.processedLivestreamIds.has(livestream.entityId)) {
        console.log(
          `Skipping already processed livestream: ${livestream.entityId}`
        );
        return;
      }

      this.processedLivestreamIds.add(livestream.entityId);
      if (this.processedLivestreamIds.size > 1000) {
        const idsArray = Array.from(this.processedLivestreamIds);
        this.processedLivestreamIds = new Set(
          idsArray.slice(idsArray.length - 500)
        );
      }

      const livestreamEvent: LivestreamEvent = {
        feedId: livestream.entityId,
        hostId: livestream.hostId,
        experienceId: livestream.experienceId,
        title: livestream.title,
        startedAt: new Date(parseInt(livestream.startedAt)),
      };

      console.log(
        `Detected livestream start: ${livestream.entityId} by host ${livestream.hostId}`
      );
      this.emit(ChatEventType.LIVESTREAM_STARTED, livestreamEvent);

      const result = await this.livestreamHandler.handleUserLive(
        livestreamEvent.hostId,
        livestreamEvent.feedId,
        livestreamEvent.experienceId
      );

      console.log(`Sent livestream welcome message: ${result}`);
    } catch (error) {
      console.error("Error handling livestream event:", error);
    }
  }
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
