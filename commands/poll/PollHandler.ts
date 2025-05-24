import { EventEmitter } from "events";
import { sendMessage } from "../../lib/whopClient/chatApi";
import { sendPollResultsWebhook } from "./PollWebhooks";
import { FeedTypes } from "../../lib/whopClient/graphql/types";

export interface PollOption {
  id: string;
  text: string;
}

export interface PollVote {
  userId: string;
  optionId: string;
  timestamp: Date;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  votes: PollVote[];
  creatorId: string;
  feedId: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface PollResult {
  optionId: string;
  text: string;
  votes: number;
  percentage: number;
}

/**
 * Handler for poll-related functionality
 */
export class PollHandler extends EventEmitter {
  private static instance: PollHandler;
  private polls: Map<string, Poll> = new Map();
  private pollTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
    console.log("PollHandler initialized");
  }

  /**
   * Get the singleton instance of PollHandler
   */
  public static getInstance(): PollHandler {
    if (!PollHandler.instance) {
      PollHandler.instance = new PollHandler();
    }
    return PollHandler.instance;
  }

  /**
   * Create a new poll
   * @param id The unique ID for the poll
   * @param question The poll question
   * @param options The poll options
   * @param creatorId The user ID of the poll creator
   * @param feedId The ID of the feed where the poll was created
   * @param durationMinutes The duration of the poll in minutes
   * @returns The created poll
   */
  public createPoll(
    id: string,
    question: string,
    options: PollOption[],
    creatorId: string,
    feedId: string,
    durationMinutes: number = 5
  ): Poll {
    if (options.length < 2) {
      throw new Error("A poll must have at least 2 options");
    }

    if (this.polls.has(id)) {
      throw new Error(`Poll with ID ${id} already exists`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const poll: Poll = {
      id,
      question,
      options,
      votes: [],
      creatorId,
      feedId,
      createdAt: now,
      expiresAt,
      isActive: true,
    };

    this.polls.set(id, poll);
    console.log(`Poll created: ${id}, expires at ${expiresAt}`);

    const timeout = setTimeout(() => {
      this.endPoll(id);
    }, durationMinutes * 60 * 1000);

    this.pollTimeouts.set(id, timeout);

    return poll;
  }

  /**
   * End a poll and announce the results
   * @param pollId The ID of the poll to end
   * @returns The poll results
   */
  public async endPoll(pollId: string): Promise<PollResult[] | null> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      console.log(`Poll ${pollId} not found`);
      return null;
    }

    if (!poll.isActive) {
      console.log(`Poll ${pollId} is already ended`);
      return null;
    }

    poll.isActive = false;
    this.polls.set(pollId, poll);

    const timeout = this.pollTimeouts.get(pollId);
    if (timeout) {
      clearTimeout(timeout);
      this.pollTimeouts.delete(pollId);
    }

    const results = this.calculatePollResults(pollId);
    if (!results) {
      return null;
    }

    const formattedResults = results
      .sort((a, b) => b.votes - a.votes)
      .map(
        (result) =>
          `${result.text}: ${result.votes} vote${
            result.votes !== 1 ? "s" : ""
          } (${result.percentage.toFixed(1)}%)`
      )
      .join("\n");

    const maxVotes = Math.max(...results.map((r) => r.votes));
    const winners = results.filter((r) => r.votes === maxVotes);

    let winnerText = "";
    if (winners.length === 0 || maxVotes === 0) {
      winnerText = "No votes were cast.";
    } else if (winners.length === 1) {
      winnerText = `Winner: ${winners[0].text}`;
    } else {
      winnerText = `Tie between: ${winners.map((w) => w.text).join(", ")}`;
    }

    try {
      await sendMessage({
        feedId: poll.feedId,
        message: `📊 **Poll Results: ${poll.question}**\n\n${formattedResults}\n\n${winnerText}\n\nTotal votes: ${poll.votes.length}`,
        feedType: "chat_feed" as FeedTypes,
      });

      try {
        const totalVotes = poll.votes.length;
        await sendPollResultsWebhook(
          pollId,
          poll.question,
          results,
          totalVotes
        );
        console.log("Poll results webhook sent successfully");
      } catch (webhookError) {
        console.error("Error sending poll results webhook:", webhookError);
      }

      console.log(`Poll ${pollId} ended and results announced`);
    } catch (error) {
      console.error(`Error announcing poll results:`, error);
    }

    return results;
  }

  /**
   * Cast a vote in a poll
   * @param pollId The ID of the poll
   * @param userId The ID of the user casting the vote
   * @param optionId The ID of the option being voted for
   * @returns True if the vote was cast successfully, false otherwise
   */
  public castVote(pollId: string, userId: string, optionId: string): boolean {
    const poll = this.polls.get(pollId);
    if (!poll) {
      console.log(`Poll ${pollId} not found`);
      return false;
    }

    if (!poll.isActive) {
      console.log(`Poll ${pollId} is not active`);
      return false;
    }

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) {
      console.log(`Option ${optionId} not found in poll ${pollId}`);
      return false;
    }

    poll.votes = poll.votes.filter((v) => v.userId !== userId);

    poll.votes.push({
      userId,
      optionId,
      timestamp: new Date(),
    });

    this.polls.set(pollId, poll);
    console.log(
      `Vote cast by ${userId} for option ${optionId} in poll ${pollId}`
    );

    return true;
  }

  /**
   * Calculate the results of a poll
   * @param pollId The ID of the poll
   * @returns The poll results
   */
  public calculatePollResults(pollId: string): PollResult[] | null {
    const poll = this.polls.get(pollId);
    if (!poll) {
      console.log(`Poll ${pollId} not found`);
      return null;
    }

    const totalVotes = poll.votes.length;
    const results: PollResult[] = poll.options.map((option) => {
      const optionVotes = poll.votes.filter(
        (v) => v.optionId === option.id
      ).length;
      const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;

      return {
        optionId: option.id,
        text: option.text,
        votes: optionVotes,
        percentage,
      };
    });

    return results;
  }

  /**
   * Get a poll by ID
   * @param pollId The ID of the poll
   * @returns The poll or null if not found
   */
  public getPoll(pollId: string): Poll | null {
    const poll = this.polls.get(pollId);
    return poll || null;
  }

  /**
   * Get all active polls
   * @returns An array of active polls
   */
  public getActivePolls(): Poll[] {
    return Array.from(this.polls.values()).filter((p) => p.isActive);
  }

  /**
   * Get recent polls, both active and inactive
   * @param limit The maximum number of polls to return
   * @returns An array of recent polls
   */
  public getRecentPolls(limit: number = 10): Poll[] {
    return Array.from(this.polls.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Force end all active polls
   * @returns The number of polls ended
   */
  public endAllPolls(): number {
    const activePolls = this.getActivePolls();
    let endedCount = 0;

    for (const poll of activePolls) {
      this.endPoll(poll.id);
      endedCount++;
    }

    return endedCount;
  }
}
