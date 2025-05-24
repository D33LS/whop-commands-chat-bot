import { WebhookService } from "./WebhookService";

/**
 * Send a moderation action webhook
 * @param action The moderation action (e.g., 'mute', 'unmute', 'ban')
 * @param targetUserId The user ID of the moderated user
 * @param targetUsername The username of the moderated user
 * @param moderatorId The user ID of the moderator
 * @param moderatorUsername The username of the moderator
 * @param reason Optional reason for the moderation action
 * @param duration Optional duration of the moderation in seconds
 * @param targetName Optional name of the moderated user
 * @param targetAvatar Optional avatar of the moderated user
 * @param moderatorName Optional name of the moderator
 * @param createdAt Optional time user joined the whop platform
 * @returns The webhook response
 */
export async function sendModerationWebhook(
  action: string,
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  reason?: string,
  duration?: number,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  const webhookService = WebhookService.getInstance();
  let durationText = "";
  if (duration) {
    if (duration < 60) {
      durationText = `${duration} seconds`;
    } else if (duration < 3600) {
      const minutes = Math.floor(duration / 60);
      durationText = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else if (duration < 86400) {
      const hours = Math.floor(duration / 3600);
      durationText = `${hours} hour${hours !== 1 ? "s" : ""}`;
    } else {
      const days = Math.floor(duration / 86400);
      durationText = `${days} day${days !== 1 ? "s" : ""}`;
    }
  }

  let color = 0x6c5dd3;
  switch (action.toLowerCase()) {
    case "mute":
      color = 0xffaa00;
      break;
    case "unmute":
      color = 0x46a758;
      break;
    case "ban":
      color = 0xe54d2e;
      break;
    case "unban":
      color = 0x0090ff;
      break;
    case "admin whitelist":
      color = 0x0090ff;
      break;
    case "admin unwhitelist":
      color = 0xffa500;
      break;
  }

  const fields = [
    {
      name: "Member",
      value: `@${targetUsername}`,
      inline: true,
    },
    {
      name: "Moderator",
      value: `@${moderatorUsername}`,
      inline: true,
    },
  ];

  if (durationText) {
    fields.push({
      name: "Duration",
      value: durationText,
      inline: true,
    });
  }

  if (reason) {
    fields.push({
      name: "Reason",
      value: reason,
      inline: false,
    });
  }

  fields.push({
    name: "Whop Join Date",
    value: createdAt,
    inline: true,
  });

  let pastTenseAction, pastTenseActionLowercase;

  switch (action.toLowerCase()) {
    case "ban":
      pastTenseAction = "Banned";
      pastTenseActionLowercase = "banned";
      break;
    case "unban":
      pastTenseAction = "Unbanned";
      pastTenseActionLowercase = "unbanned";
      break;
    case "mute":
      pastTenseAction = "Muted";
      pastTenseActionLowercase = "muted";
      break;
    case "unmute":
      pastTenseAction = "Unmuted";
      pastTenseActionLowercase = "unmuted";
      break;
    case "admin whitelist":
      pastTenseAction = "Admin Whitelisted";
      pastTenseActionLowercase = "admin whitelisted";
      break;
    case "admin unwhitelist":
      pastTenseAction = "Admin Unwhitelisted";
      pastTenseActionLowercase = "admin unwhitelisted";
      break;
    default:
      pastTenseAction = action.charAt(0).toUpperCase() + action.slice(1) + "ed";
      pastTenseActionLowercase =
        action.toLowerCase() +
        (action.toLowerCase().endsWith("e") ? "d" : "ed");
  }

  const embed = webhookService.createRichEmbed({
    title: `${pastTenseAction} ${targetName || targetUsername}`,
    url: `https://whop.com/messages/?to_user_id=${targetUserId}`,
    description: `${
      targetName || targetUsername
    } has been ${pastTenseActionLowercase} in the chat`,
    color,
    fields,
    footer: {
      text: `Whop Moderation`,
      icon_url: "https://whop.com/favicon.ico",
    },
    // thumbnail: targetAvatar ? { url: targetAvatar } : undefined,
  });

  //extra footer icon https://imgur.com/h16QfgR.png
  return webhookService.sendEmbeds("moderation", [embed]);
}

/**
 * Send a mute webhook
 */
export async function sendMuteWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  duration?: number,
  reason?: string,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "mute",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    reason,
    duration,
    targetName,
    targetAvatar,
    moderatorName,
    createdAt
  );
}

/**
 * Send an unmute webhook
 */
export async function sendUnmuteWebhook(
  targetUserId: string,
  targetUsername: string,
  targetName: string,
  moderatorId: string,
  moderatorUsername: string
  //   createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "unmute",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    undefined,
    undefined,
    targetName
    // createdAt
  );
}

/**
 * Send a ban webhook
 */
export async function sendBanWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  reason?: string,
  targetName?: string,
  targetAvatar?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "ban",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    reason,
    undefined,
    targetName,
    targetAvatar,
    undefined,
    createdAt
  );
}

/**
 * Send an unban webhook
 */
export async function sendUnbanWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  reason?: string,
  targetName?: string
): Promise<any> {
  return sendModerationWebhook(
    "unban",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    reason,
    undefined,
    targetName
  );
}

/**
 * Send an admin has been whitelisted webhook
 */
export async function sendAdminWhitelistedWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "Admin Whitelist",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    "Added to admin whitelist",
    undefined,
    targetName,
    targetAvatar,
    moderatorName,
    createdAt
  );
}

/**
 * Send an admin has been unwhitelisted webhook
 */
export async function sendAdminUnwhitelistedWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "adminunwhitelist",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    "Removed from admin whitelist",
    undefined,
    targetName,
    targetAvatar,
    moderatorName,
    createdAt
  );
}

/**
 * Send a user has been whitelisted webhook
 */
export async function sendWhitelistedWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "whitelist",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    "Added to cooldown whitelist",
    undefined,
    targetName,
    targetAvatar,
    moderatorName,
    createdAt
  );
}

/**
 * Send a user has been unwhitelisted webhook
 */
export async function sendUnwhitelistedWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  targetName?: string,
  targetAvatar?: string,
  moderatorName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  return sendModerationWebhook(
    "unwhitelist",
    targetUserId,
    targetUsername,
    moderatorId,
    moderatorUsername,
    "Removed from cooldown whitelist",
    undefined,
    targetName,
    targetAvatar,
    moderatorName,
    createdAt
  );
}

/**
 * Send a kick webhook
 */
export async function sendKickWebhook(
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorUsername: string,
  reason?: string,
  targetName?: string,
  createdAt: string = "Unknown"
): Promise<any> {
  const webhookService = WebhookService.getInstance();

  const fields = [
    {
      name: "Member",
      value: `@${targetUsername}`,
      inline: true,
    },
    {
      name: "Moderator",
      value: `@${moderatorUsername}`,
      inline: true,
    },
  ];

  if (reason) {
    fields.push({
      name: "Reason",
      value: reason,
      inline: false,
    });
  }

  fields.push({
    name: "Whop Join Date",
    value: createdAt,
    inline: true,
  });

  const embed = webhookService.createRichEmbed({
    title: `Kicked ${targetName || targetUsername}`,
    url: `https://whop.com/messages/?to_user_id=${targetUserId}`,
    description: `${
      targetName || targetUsername
    } has been kicked from the Whop`,
    color: 0xff6b6b, // Red-ish color
    fields,
    footer: {
      text: `Whop Moderation`,
      icon_url: "https://whop.com/favicon.ico",
    },
  });

  return webhookService.sendEmbeds("moderation", [embed]);
}

// /**
//  * Send a webhook notification about the purge
//  * @param webhookService The WebhookService instance
//  * @param moderatorId The ID of the moderator who requested the purge
//  * @param feedId The ID of the feed
//  * @param messageCount The number of messages purged
//  */
// async function sendPurgeWebhook(
//   webhookService: WebhookService,
//   moderatorId: string,
//   feedId: string,
//   messageCount: number
// ): Promise<void> {
//   try {
//     // Create an embed for the webhook
//     const embed = webhookService.createRichEmbed({
//       title: "🧹 Chat Messages Purged",
//       description: `${messageCount} messages have been purged from feed ID: ${feedId}`,
//       color: 0xff9500, // Orange
//       fields: [
//         {
//           name: "Moderator",
//           value: `<@${moderatorId}>`,
//           inline: true,
//         },
//         {
//           name: "Messages Purged",
//           value: `${messageCount}`,
//           inline: true,
//         },
//         {
//           name: "Timestamp",
//           value: new Date().toISOString(),
//           inline: true,
//         },
//       ],
//       footer: {
//         text: `Whop Moderation • Purge`,
//       },
//     });

//     // Send the webhook
//     await webhookService.sendEmbeds("moderation", [embed]);
//     console.log("Purge webhook sent successfully");
//   } catch (error) {
//     console.error("Error sending purge webhook:", error);
//     throw error;
//   }
// }
