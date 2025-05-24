export * from "./staticCommands";
import { CommandContext, CommandResult } from "@/lib/handlers/CommandHandler";
import { parseNewLiveCommand, executeNewLiveCommand } from "./newLiveCommand";
import {
  parseMuteCommand,
  executeMuteCommand,
  handleMuteFailure,
} from "./muteCommand";
import {
  parseUnmuteCommand,
  executeUnmuteCommand,
  handleUnmuteFailure,
} from "./unmuteCommand";
import {
  parseBanCommand,
  executeBanCommand,
  handleBanFailure,
} from "./banCommand";
import { parsePollCommand, executePollCommand } from "./poll/pollCommand";
import {
  parseAdminWhitelistCommand,
  executeAdminWhitelistCommand,
  handleAdminWhitelistFailure,
} from "./adminWhitelistCommand";
import {
  parseTranscriptCommand,
  executeTranscriptCommand,
  handleTranscriptFailure,
} from "./transcriptCommand";
import {
  parseContentRewardsCommand,
  executeContentRewardsCommand,
} from "./contentRewardsCommand";
import {
  parseEarningsCommand,
  executeEarningsCommand,
} from "./earningsCommand";
import {
  parseRemindMeCommand,
  executeRemindMeCommand,
} from "./remindMeCommand";
import {
  parseAnnounceCommand,
  executeAnnounceCommand,
} from "./announceCommand";
import {
  parseWhitelistCommand,
  executeWhitelistCommand,
  handleWhitelistFailure,
} from "./whitelistCommand";
import {
  parseCooldownCommand,
  executeCooldownCommand,
} from "./cooldownCommand";
import {
  parseKickCommand,
  executeKickCommand,
  handleKickFailure,
} from "./kickCommand";
import { parsePurgeCommand, executePurgeCommand } from "./purgeCommand";
import {
  parseReferralsCommand,
  executeReferralsCommand,
} from "./referralsCommand";
import {
  parseAddFreeDaysCommand,
  executeAddFreeDaysCommand,
  handleAddFreeDaysFailure,
} from "./addFreeDaysCommand";
import {
  parseAffiliateLinkCommand,
  executeAffiliateLinkCommand,
} from "./affiliateLinkCommand";
import {
  parseScheduleCommand,
  executeScheduleCommand,
} from "./scheduleCommand";

export async function executeHelpCommand(
  _: {},
  ctx: CommandContext
): Promise<CommandResult> {
  let helpMessage = `
  Available commands
  /help
  /faq  
  /support  
  /clip
  /geniusbar
  /new
  /create
  /payouts
  /campaigns
  /graphics
  /leaderboard
  /contentrewards [contentType] [category] [platform] [orderBy]
  /earnings @[username] | /earnings (for yourself)
  /referrals @[username] | /referrals (for yourself)
  /zap
  /eric
  /affiliatelink @[username] | /affiliatelink (for yourself)
    `.trim();

  if (ctx.isAdmin) {
    helpMessage = `
  Regular commands
  /help
  /faq  
  /support  
  /clip
  /geniusbar
  /new
  /create
  /payouts
  /campaigns
  /graphics
  /leaderboard
  /contentrewards [contentType] [category] [platform] [orderBy]
  /earnings @[username] | /earnings (for yourself)
  /referrals @[username] | /referrals (for yourself)
  /affiliatelink @[username] | /affiliatelink (for yourself)
  /zap
  /eric
  
  Admin-only commands
   /announce "message" [highlight]  
   /startpromo <uses> <discount>  
   /poll "question" "opt1" "opt2" ...  
   /newlive "message"
   /mute @[username] [duration][m|d|w]   (e.g., 5m, 2d, 1w for minutes, days, weeks)
   /unmute @[username]
   /ban @[username] [reason] [delete]
   /unban @[username]
   /adminwhitelist list | /adminwhitelist add @[username] | /adminwhitelist remove @[username]
   /whitelist list | /whitelist add @[username] | /whitelist remove @[username]
   /unwhitelist @[username]
   /cooldown [minutes] set | /cooldown get
   /remindme "messgage" in <number>m|h|d
   /transcript [count]   (fetches the last [count] messages, default 50)
   /purge [count]   (deletes the last [count] messages, default 10)
   /scan [action] [threshold]
   /addfreedays @[username] <number>
   /schedule "message" every <number>m|h|d
    `.trim();
  }

  await ctx.sendMessage({
    feedId: ctx.feedId,
    message: helpMessage,
    feedType: ctx.feedType,
  });

  return {
    success: true,
    message: "Help message sent to chat.",
  };
}

export const COMMANDS = {
  help: {
    parse: () => ({}),
    exec: executeHelpCommand,
    usage: "/help",
  },
  referrals: {
    parse: parseReferralsCommand,
    exec: executeReferralsCommand,
    adminOnly: false,
    usage: "/referrals @[username] | /referrals (for yourself)",
  },
  affiliatelink: {
    parse: parseAffiliateLinkCommand,
    exec: executeAffiliateLinkCommand,
    adminOnly: false,
    usage: "/affiliatelink @[username] | /affiliatelink (for yourself)",
  },
  announce: {
    parse: parseAnnounceCommand,
    exec: executeAnnounceCommand,
    adminOnly: true,
    usage: '/announce "message" [highlight]',
  },
  schedule: {
    parse: parseScheduleCommand,
    exec: executeScheduleCommand,
    adminOnly: true,
    usage: '/schedule "message" every <number>m|h|d',
  },
  transcript: {
    parse: parseTranscriptCommand,
    exec: executeTranscriptCommand,
    adminOnly: true,
    usage: "/transcript [count]",
    webhookOnFailure: handleTranscriptFailure,
  },
  purge: {
    parse: parsePurgeCommand,
    exec: executePurgeCommand,
    adminOnly: true,
    usage: "/purge [count]",
  },
  addfreedays: {
    parse: parseAddFreeDaysCommand,
    exec: executeAddFreeDaysCommand,
    adminOnly: true,
    usage: "/addfreedays @[username] <number>",
    webhookOnFailure: handleAddFreeDaysFailure,
  },
  cooldown: {
    parse: parseCooldownCommand,
    exec: executeCooldownCommand,
    adminOnly: true,
    usage: "/cooldown [minutes] set | /cooldown get",
  },
  whitelist: {
    parse: parseWhitelistCommand,
    exec: executeWhitelistCommand,
    adminOnly: true,
    usage:
      "/whitelist list | /whitelist add @[username] | /whitelist remove @[username]",
    webhookOnFailure: handleWhitelistFailure,
  },
  adminwhitelist: {
    parse: parseAdminWhitelistCommand,
    exec: executeAdminWhitelistCommand,
    adminOnly: true,
    usage:
      "/adminwhitelist list | /adminwhitelist add @[username] | /adminwhitelist remove @[username]",
    webhookOnFailure: handleAdminWhitelistFailure,
  },
  newlive: {
    parse: parseNewLiveCommand,
    exec: executeNewLiveCommand,
    adminOnly: true,
    usage: '/newlive "message"',
  },
  mute: {
    parse: parseMuteCommand,
    exec: executeMuteCommand,
    adminOnly: true,
    usage:
      "/mute @[username] [duration][m|d|w] (e.g., 5m, 2d, 1w for minutes, days, weeks)",
    webhookOnFailure: handleMuteFailure,
  },
  unmute: {
    parse: parseUnmuteCommand,
    exec: executeUnmuteCommand,
    adminOnly: true,
    usage: "/unmute @[username]",
    webhookOnFailure: handleUnmuteFailure,
  },
  ban: {
    parse: parseBanCommand,
    exec: executeBanCommand,
    adminOnly: true,
    usage: "/ban @[username] [reason] [delete]",
    webhookOnFailure: handleBanFailure,
  },
  poll: {
    parse: parsePollCommand,
    exec: executePollCommand,
    adminOnly: true,
    usage: '/poll "question" "opt1" "opt2" ...',
  },
  contentrewards: {
    parse: parseContentRewardsCommand,
    exec: executeContentRewardsCommand,
    adminOnly: false,
    usage: "/contentrewards [contentType] [category] [platform] [orderBy]",
  },
  earnings: {
    parse: parseEarningsCommand,
    exec: executeEarningsCommand,
    adminOnly: false,
    usage: "/earnings @[username] | /earnings (for yourself)",
  },
  remindme: {
    parse: parseRemindMeCommand,
    exec: executeRemindMeCommand,
    adminOnly: false,
    usage: '/remindme "message" in <number>m|h|d',
  },
  kick: {
    parse: parseKickCommand,
    exec: executeKickCommand,
    adminOnly: true,
    usage: "/kick @[username] [reason]",
    webhookOnFailure: handleKickFailure,
  },
};
