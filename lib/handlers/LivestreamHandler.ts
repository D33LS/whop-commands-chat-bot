import { EventEmitter } from "events";
import { sendMessage } from "../whopClient/chatApi";

/**
 * Handler for livestream-related events
 */
export class LivestreamHandler extends EventEmitter {
  private static instance: LivestreamHandler;
  private liveMessages: Map<string, string> = new Map();
  private processedLivestreams: Set<string> = new Set();
  private constructor() {
    super();
    console.log("LivestreamHandler initialized");
  }

  /**
   * Get the singleton instance of LivestreamHandler
   */
  public static getInstance(): LivestreamHandler {
    if (!LivestreamHandler.instance) {
      LivestreamHandler.instance = new LivestreamHandler();
    }
    return LivestreamHandler.instance;
  }

  /**
   * Set a custom message for when a user goes live
   * @param userId The user ID of the streamer
   * @param message The message to send when they go live
   */
  public setLiveMessage(userId: string, message: string): void {
    this.liveMessages.set(userId, message);
    console.log(`Set live message for user ${userId}: ${message}`);
  }

  /**
   * Get the live message for a user
   * @param userId The user ID of the streamer
   * @returns The message to send when they go live, or undefined if not set
   */
  public getLiveMessage(userId: string): string | undefined {
    return this.liveMessages.get(userId);
  }

  /**
   * Reset the live message for a user
   * @param userId The user ID of the streamer
   */
  public resetLiveMessage(userId: string): void {
    this.liveMessages.delete(userId);
    console.log(`Reset live message for user ${userId}`);
  }

  /**
   * Handle a user going live
   * @param userId The user ID of the streamer
   * @param feedId The ID of the livestream feed
   * @param experienceId The ID of the experience
   * @returns true if a message was sent, false otherwise
   */
  public async handleUserLive(
    userId: string,
    feedId: string,
    experienceId: string
  ): Promise<boolean> {
    if (this.processedLivestreams.has(feedId)) {
      console.log(`Livestream ${feedId} already processed`);
      return false;
    }

    this.processedLivestreams.add(feedId);

    if (this.processedLivestreams.size > 1000) {
      const idsArray = Array.from(this.processedLivestreams);
      this.processedLivestreams = new Set(
        idsArray.slice(idsArray.length - 500)
      );
    }

    const message =
      this.getLiveMessage(userId) ||
      "📢 Welcome to the stream! Thanks for joining us!";

    try {
      await sendMessage({
        feedId,
        message,
        feedType: "livestream_feed" as any,
      });

      console.log(`Sent live message to feed ${feedId} for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error sending live message:`, error);
      return false;
    }
  }
}

// will implement when db is setup

// /**
//  * Check if a user is posting for the first time in a feed
//  * @param userId The user ID
//  * @param feedId The feed ID
//  * @returns True if this is the user's first post in the feed
//  */
// private async checkFirstTimePost(
//   userId: string,
//   feedId: string
// ): Promise<boolean> {
//   try {
//     const { data, error } = await this.supabase
//       .from("users")
//       .select("*")
//       .eq("user_id", userId)
//       .eq("feed_id", feedId)
//       .single();

//     if (error && error.code !== "PGRST116") {
//       // PGRST116 is "Row not found" error, which is expected for first-time posters
//       throw error;
//     }

//     if (!data) {
//       // Insert the user into the users table
//       // await this.supabase.from("users").insert({
//       //   user_id: userId,
//       //   feed_id: feedId,
//       //   first_seen_at: new Date(),
//       // });

//       return true;
//     }

//     return false;
//   } catch (error) {
//     console.error("Error checking first-time post:", error);
//     return false;
//   }
// }

/**
 * Send a welcome message to a first-time poster
 * @param message The chat message from the first-time poster
 */
// private async sendWelcomeMessage(message: ChatMessage): Promise<void> {
//   try {
//     const welcomeMessage = `Welcome to the chat, @${message.username}! 👋 Great to have you here!`;

//     await sendMessage({
//       feedId: message.feedId,
//       message: welcomeMessage,
//     });

//     console.log(
//       `Sent welcome message to ${message.username} in feed ${message.feedId}`
//     );
//   } catch (error) {
//     console.error("Error sending welcome message:", error);
//   }
// }
