import { WebhookService } from "./WebhookService";

/**
 * Log levels for webhook messages
 */
export enum LogLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  DEBUG = "debug",
  SUCCESS = "success",
}

/**
 * Mapping of log levels to colors
 */
const LogLevelColors = {
  [LogLevel.INFO]: 0x95a5a6, // Blue
  [LogLevel.WARNING]: 0xf39c12, // Orange
  [LogLevel.ERROR]: 0xe74c3c, // Red
  [LogLevel.DEBUG]: 0x3498db, // Gray
  [LogLevel.SUCCESS]: 0x2ecc71, // Green
};

/**
 * Send a log message to the log webhook
 * @param level The log level
 * @param title The log title
 * @param message The log message
 * @param metadata Optional additional metadata to include
 * @returns The webhook response
 */
export async function sendLogWebhook(
  level: LogLevel,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  const webhookService = WebhookService.getInstance();

  const fields = [];

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      fields.push({
        name: key,
        value:
          typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value),
        inline: String(value).length < 50,
      });
    }
  }

  fields.push({
    name: "Timestamp",
    value: new Date().toISOString(),
    inline: true,
  });

  const color = LogLevelColors[level] || LogLevelColors[LogLevel.INFO];

  const embed = webhookService.createRichEmbed({
    title: `[${level.toUpperCase()}] ${title}`,
    description: message,
    color,
    fields,
    footer: {
      text: `Whop Bot Logs • ${level}`,
    },
  });

  return webhookService.sendEmbeds("log", [embed]);
}

/**
 * Convenience method for sending an info log
 */
export async function logInfo(
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  return sendLogWebhook(LogLevel.INFO, title, message, metadata);
}

/**
 * Convenience method for sending a warning log
 */
export async function logWarning(
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  return sendLogWebhook(LogLevel.WARNING, title, message, metadata);
}

/**
 * Convenience method for sending an error log
 */
export async function logError(
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  return sendLogWebhook(LogLevel.ERROR, title, message, metadata);
}

/**
 * Convenience method for sending a debug log
 */
export async function logDebug(
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  return sendLogWebhook(LogLevel.DEBUG, title, message, metadata);
}

/**
 * Convenience method for sending a success log
 */
export async function logSuccess(
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<any> {
  return sendLogWebhook(LogLevel.SUCCESS, title, message, metadata);
}

/**
 * Error messages
 */
export function getFriendlyErrorMessage(error: any): string {
  if (error.networkError?.statusCode === 500) {
    return "The server encountered an error. Please try again later.";
  }

  if (error.message?.includes("Response not successful")) {
    return "The service is currently unavailable. Please try again later.";
  }

  if (error.graphQLErrors?.length > 0) {
    return error.graphQLErrors[0].message || "API request failed";
  }
  return error.message || "An unexpected error occurred";
}
