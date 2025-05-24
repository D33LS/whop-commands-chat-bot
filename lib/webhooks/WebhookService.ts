export interface WebhookEmbed {
  type?: string;
  url?: string;
  title?: string;
  color?: number;
  timestamp?: string | Date;
  description?: string;
  image?: {
    url: string;
  } | null;
  thumbnail?: {
    url: string;
  } | null;
  footer?: {
    text: string;
    icon_url?: string;
  } | null;
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

export interface WebhookAttachment {
  id?: string;
  filename?: string;
  description?: string;
  duration_secs?: number;
  waveform?: string;
  title?: string;
  is_remix?: boolean;
}

export interface WebhookPayload {
  content?: string;
  embeds?: WebhookEmbed[];
  attachments?: WebhookAttachment[];
}

export class WebhookService {
  private static instance: WebhookService;
  private webhooks: Map<string, string> = new Map();
  private constructor() {
    console.log("WebhookService initialized");
    const WEBHOOK_URLS = process.env.WEBHOOK_URLS || "{}";
    try {
      const webhookMap = JSON.parse(WEBHOOK_URLS);
      Object.entries(webhookMap).forEach(([key, value]) => {
        this.webhooks.set(key, value as string);
      });
    } catch (error) {
      console.error("Error parsing WEBHOOK_URLS:", error);
    }

    const moderationWebhook = process.env.MODERATION_WEBHOOK_URL;
    if (moderationWebhook) {
      this.webhooks.set("moderation", moderationWebhook);
    }

    const pollWebhook = process.env.POLL_WEBHOOK_URL;
    if (pollWebhook) {
      this.webhooks.set("poll", pollWebhook);
    }

    const logWebhook = process.env.LOG_WEBHOOK_URL;
    if (logWebhook) {
      this.webhooks.set("log", logWebhook);
    }

    const contentRewardsWebhook = process.env.CONTENT_REWARDS_WEBHOOK_URL;
    if (contentRewardsWebhook) {
      this.webhooks.set("content_rewards", contentRewardsWebhook);
    }
  }

  /**
   * Get the singleton instance of WebhookService
   */
  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Add or update a webhook URL
   * @param name The name/key for the webhook
   * @param url The webhook URL
   */
  public setWebhookUrl(name: string, url: string): void {
    this.webhooks.set(name, url);
  }

  /**
   * Get a webhook URL by name
   * @param name The name/key for the webhook
   * @returns The webhook URL or undefined if not found
   */
  public getWebhookUrl(name: string): string | undefined {
    return this.webhooks.get(name);
  }

  /**
   * Send a webhook with just content
   * @param webhookName The name of the webhook to use
   * @param content The content to send
   * @returns The response from the webhook
   */
  public async sendContent(webhookName: string, content: string): Promise<any> {
    return this.sendWebhook(webhookName, { content });
  }

  /**
   * Send a webhook with content and embeds
   * @param webhookName The name of the webhook to use
   * @param content The content to send
   * @param embeds The embeds to send
   * @returns The response from the webhook
   */
  public async sendContentWithEmbeds(
    webhookName: string,
    content: string,
    embeds: WebhookEmbed[]
  ): Promise<any> {
    return this.sendWebhook(webhookName, { content, embeds });
  }

  /**
   * Send a webhook with just embeds
   * @param webhookName The name of the webhook to use
   * @param embeds The embeds to send
   * @returns The response from the webhook
   */
  public async sendEmbeds(
    webhookName: string,
    embeds: WebhookEmbed[]
  ): Promise<any> {
    return this.sendWebhook(webhookName, { embeds });
  }

  /**
   * Send a webhook with a full custom payload
   * @param webhookName The name of the webhook to use
   * @param payload The complete webhook payload
   * @returns The response from the webhook
   */
  public async sendWebhook(
    webhookName: string,
    payload: WebhookPayload
  ): Promise<any> {
    const webhookUrl = this.webhooks.get(webhookName);
    if (!webhookUrl) {
      throw new Error(`Webhook URL not found for name: ${webhookName}`);
    }

    try {
      console.log(
        `Sending webhook to ${webhookName}:`,
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Webhook request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const contentLength = response.headers.get("content-length");
      const contentType = response.headers.get("content-type");

      if (
        !contentLength ||
        parseInt(contentLength) === 0 ||
        !contentType?.includes("application/json")
      ) {
        console.log(
          `Webhook sent successfully to ${webhookName} (empty response)`
        );
        return { success: true };
      }
      const responseText = await response.text();

      const data = responseText ? JSON.parse(responseText) : { success: true };
      console.log(`Webhook sent successfully to ${webhookName}:`, data);
      return data;
    } catch (error) {
      console.error(`Error sending webhook to ${webhookName}:`, error);
      throw error;
    }
  }

  /**
   * Create a basic embed object with standard formatting
   * @param title The embed title
   * @param description The embed description
   * @param color Optional color (defaults to Whop purple)
   * @returns A configured embed object
   */
  public createBasicEmbed(
    title: string,
    description: string,
    color: number = 0xfa4616
  ): WebhookEmbed {
    return {
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a rich embed with additional options
   * @param options Embed configuration options
   * @returns A configured embed object
   */
  public createRichEmbed(options: {
    title?: string;
    description?: string;
    color?: number;
    url?: string;
    fields?: WebhookEmbed["fields"];
    footer?: WebhookEmbed["footer"];
    image?: string;
    thumbnail?: { url: string };
  }): WebhookEmbed {
    const embed: WebhookEmbed = {
      title: options.title,
      description: options.description,
      color: options.color ?? 0xfa4616,
      timestamp: new Date().toISOString(),
      url: options.url,
      fields: options.fields,
      footer: options.footer,
    };

    if (options.image) {
      embed.image = { url: options.image };
    }

    if (options.thumbnail) {
      embed.thumbnail = {
        url:
          typeof options.thumbnail === "string"
            ? options.thumbnail
            : options.thumbnail.url,
      };
    }

    return embed;
  }
}
