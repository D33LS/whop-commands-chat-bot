import { WebhookService } from "@/lib/webhooks/WebhookService";

export interface PollOption {
  id: string;
  text: string;
}

export interface PollResult {
  optionId: string;
  text: string;
  votes: number;
  percentage: number;
}

/**
 * Send a poll creation webhook
 * @param pollId The ID of the poll
 * @param question The poll question
 * @param options The poll options
 * @param creatorId The creator's user ID
 * @param creatorUsername The creator's username
 * @param durationMinutes The duration of the poll in minutes
 * @returns The webhook response
 */
export async function sendPollCreationWebhook(
  pollId: string,
  question: string,
  options: PollOption[],
  creatorId: string,
  creatorUsername: string,
  durationMinutes: number
): Promise<any> {
  const webhookService = WebhookService.getInstance();
  const optionsText = options.map((opt) => `• ${opt.text}`).join("\n");
  const embed = webhookService.createRichEmbed({
    title: `📊 New Poll Created: ${question}`,
    // description: question,
    color: 0x3498db, // Blue
    fields: [
      {
        name: "Options",
        value: optionsText,
        inline: false,
      },
      {
        name: "",
        value: ``,
        inline: true,
      },
      {
        name: "Duration",
        value: `${durationMinutes} minutes`,
        inline: true,
      },
      {
        name: "Created by",
        value: `${creatorUsername} (${creatorId})`,
        inline: true,
      },
      // {
      //   name: "Poll ID",
      //   value: pollId,
      //   inline: true,
      // },
    ],
    // footer: {
    //   text: `Whop Polls`,
    // },
  });

  // Create content with voting instructions
  const content = `A new poll has been created! Vote using /vote ${pollId} [option number].`;

  // Send the webhook
  return webhookService.sendContentWithEmbeds("poll", content, [embed]);
}

/**
 * Send poll results webhook
 * @param pollId The ID of the poll
 * @param question The poll question
 * @param results The poll results
 * @param totalVotes The total number of votes
 * @returns The webhook response
 */
export async function sendPollResultsWebhook(
  pollId: string,
  question: string,
  results: PollResult[],
  totalVotes: number
): Promise<any> {
  const webhookService = WebhookService.getInstance();

  const sortedResults = [...results].sort((a, b) => b.votes - a.votes);

  const barLength = 15; 
  const resultsText = sortedResults
    .map((result) => {
      const bar = "█".repeat(Math.round((result.percentage * barLength) / 100));
      return `${result.text}: ${bar} ${
        result.votes
      } votes (${result.percentage.toFixed(1)}%)`;
    })
    .join("\n");
    
  const embed = webhookService.createRichEmbed({
    title: "📊 Poll Results",
    description: question,
    color: 0x2ecc71, // Green
    fields: [
      {
        name: "Results",
        value: resultsText || "No votes were cast.",
        inline: false,
      },
      {
        name: "Total Votes",
        value: `${totalVotes}`,
        inline: true,
      },
      {
        name: "Poll ID",
        value: pollId,
        inline: true,
      },
    ],
    footer: {
      text: `Whop Polls • ${new Date().toLocaleString()}`,
    },
  });

  const content = `The poll has ended! Here are the results:`;

  return webhookService.sendContentWithEmbeds("poll", content, [embed]);
}
