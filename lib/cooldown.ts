/**
 * Formats cooldown time in a user-friendly way
 * @param seconds Number of seconds remaining
 * @returns Formatted time string showing minutes and seconds when appropriate
 */
export function formatCooldownTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else {
      return `${minutes} minute${
        minutes !== 1 ? "s" : ""
      } and ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
    }
  }
}

export class CooldownManager {
  private static instance: CooldownManager;
  private lastMessageTimestamp: Map<string, number> = new Map();
  private lastCooldownNoticeTimestamp: Map<string, number> = new Map();
  private cooldownPeriod: number;
  private whitelistedUserIds: Set<string>;
  private cooldownNoticePeriod: number = 5 * 60 * 1000;

  private constructor(
    cooldownPeriodSeconds: number = 5,
    whitelistedUserIds: string[] = [],
    cooldownNoticeMinutes: number = 5
  ) {
    this.cooldownPeriod = cooldownPeriodSeconds * 1000;
    this.cooldownNoticePeriod = cooldownNoticeMinutes * 60 * 1000;
    this.whitelistedUserIds = new Set(whitelistedUserIds);

    const envWhitelist = process.env.WHOP_COOLDOWN_WHITELIST;
    if (envWhitelist) {
      envWhitelist
        .split(",")
        .forEach((id) => this.whitelistedUserIds.add(id.trim()));
    }
  }

  public static getInstance(
    cooldownPeriodSeconds?: number,
    whitelistedUserIds?: string[],
    cooldownNoticeMinutes?: number
  ): CooldownManager {
    if (!CooldownManager.instance) {
      CooldownManager.instance = new CooldownManager(
        cooldownPeriodSeconds,
        whitelistedUserIds,
        cooldownNoticeMinutes
      );
    }
    return CooldownManager.instance;
  }

  /**
   * Check if a user is currently on cooldown
   * @param userId The user's ID
   * @param isAdmin Whether the user is an admin
   * @returns An object with isOnCooldown, remainingSeconds, and formattedTime properties
   */
  public checkCooldown(
    userId: string,
    isAdmin: boolean
  ): {
    isOnCooldown: boolean;
    remainingSeconds: number;
    formattedTime: string;
  } {
    if (isAdmin || this.whitelistedUserIds.has(userId)) {
      return {
        isOnCooldown: false,
        remainingSeconds: 0,
        formattedTime: "0 seconds",
      };
    }

    const now = Date.now();
    const lastMessageTime = this.lastMessageTimestamp.get(userId) || 0;
    const timeSinceLastMessage = now - lastMessageTime;

    if (timeSinceLastMessage < this.cooldownPeriod) {
      const remainingSeconds = Math.ceil(
        (this.cooldownPeriod - timeSinceLastMessage) / 1000
      );
      return {
        isOnCooldown: true,
        remainingSeconds,
        formattedTime: formatCooldownTime(remainingSeconds),
      };
    }

    return {
      isOnCooldown: false,
      remainingSeconds: 0,
      formattedTime: "0 seconds",
    };
  }

  /**
   * Check if a user ID is whitelisted
   * @param userId The user ID to check
   * @returns True if the user is whitelisted, false otherwise
   */
  public isWhitelisted(userId: string): boolean {
    return this.whitelistedUserIds.has(userId);
  }

  /**
   * Record that a user has just sent a message
   * @param userId The user's ID
   */
  public recordMessage(userId: string): void {
    this.lastMessageTimestamp.set(userId, Date.now());
  }

  /**
   * Add a user ID to the whitelist
   * @param userId The user ID to whitelist
   */
  public addToWhitelist(userId: string): void {
    this.whitelistedUserIds.add(userId);
  }

  /**
   * Remove a user ID from the whitelist
   * @param userId The user ID to remove from the whitelist
   */
  public removeFromWhitelist(userId: string): boolean {
    return this.whitelistedUserIds.delete(userId);
  }

  /**
   * Get the list of whitelisted user IDs
   */
  public getWhitelistedUsers(): string[] {
    return Array.from(this.whitelistedUserIds);
  }

  /**
   * Check if a cooldown notice should be sent to the user
   * @param userId The user's ID
   * @returns Whether a cooldown notice should be sent
   */
  public shouldSendCooldownNotice(userId: string): boolean {
    const now = Date.now();
    const lastNoticeTime = this.lastCooldownNoticeTimestamp.get(userId) || 0;
    const timeSinceLastNotice = now - lastNoticeTime;

    return timeSinceLastNotice >= this.cooldownNoticePeriod;
  }

  /**
   * Record that a cooldown notice has been sent to the user
   * @param userId The user's ID
   */
  public recordCooldownNotice(userId: string): void {
    this.lastCooldownNoticeTimestamp.set(userId, Date.now());
  }

  /**
   * Set the cooldown notice period
   * @param minutes The cooldown notice period in minutes
   */
  public setCooldownNoticePeriod(minutes: number): void {
    this.cooldownNoticePeriod = minutes * 60 * 1000;
  }

  /**
   * Get the current cooldown notice period in minutes
   */
  public getCooldownNoticePeriod(): number {
    return this.cooldownNoticePeriod / (60 * 1000);
  }

  /**
   * Set the cooldown period
   * @param seconds The cooldown period in seconds
   */
  public setCooldownPeriod(seconds: number): void {
    this.cooldownPeriod = seconds * 1000;
  }

  /**
   * Get the current cooldown period in seconds
   */
  public getCooldownPeriod(): number {
    return this.cooldownPeriod / 1000;
  }
}
