export class AdminWhitelistManager {
  private static instance: AdminWhitelistManager;
  private adminWhitelistedUserIds: Set<string>;

  private constructor(adminWhitelistedUserIds: string[] = []) {
    this.adminWhitelistedUserIds = new Set(adminWhitelistedUserIds);
    const envAdminWhitelist = process.env.WHOP_ADMIN_WHITELIST;
    if (envAdminWhitelist) {
      console.log(
        `Loading admin whitelist from environment: ${envAdminWhitelist}`
      );
      envAdminWhitelist
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id)
        .forEach((id) => {
          this.adminWhitelistedUserIds.add(id);
          console.log(`Added ${id} to admin whitelist from environment`);
        });
    }

    console.log(
      `AdminWhitelistManager initialized with ${this.adminWhitelistedUserIds.size} admin-whitelisted users`
    );
  }

  /**
   * Get the singleton instance of AdminWhitelistManager
   */
  public static getInstance(
    adminWhitelistedUserIds?: string[]
  ): AdminWhitelistManager {
    if (!AdminWhitelistManager.instance) {
      AdminWhitelistManager.instance = new AdminWhitelistManager(
        adminWhitelistedUserIds
      );
    }
    return AdminWhitelistManager.instance;
  }

  /**
   * Check if a user ID is admin-whitelisted
   * @param userId The user ID to check
   * @returns True if the user is admin-whitelisted, false otherwise
   */
  public isAdminWhitelisted(userId: string): boolean {
    return this.adminWhitelistedUserIds.has(userId);
  }

  /**
   * Add a user ID to the admin whitelist
   * @param userId The user ID to whitelist
   */
  public addToAdminWhitelist(userId: string): void {
    this.adminWhitelistedUserIds.add(userId);
    this.saveAdminWhitelistToDB();
    console.log(`Added ${userId} to admin whitelist`);
  }

  /**
   * Remove a user ID from the admin whitelist
   * @param userId The user ID to remove from the admin whitelist
   * @returns true if the user was removed, false if they weren't in the whitelist
   */
  public removeFromAdminWhitelist(userId: string): boolean {
    const removed = this.adminWhitelistedUserIds.delete(userId);
    if (removed) {
      this.saveAdminWhitelistToDB();
      console.log(`Removed ${userId} from admin whitelist`);
    }
    return removed;
  }

  /**
   * Get the list of admin-whitelisted user IDs
   */
  public getAdminWhitelistedUsers(): string[] {
    return Array.from(this.adminWhitelistedUserIds);
  }

  /**
   * Save the current admin whitelist to db when implemented
   */
  private saveAdminWhitelistToDB(): void {
    const whitelistString = Array.from(this.adminWhitelistedUserIds).join(",");
    console.log(`Admin whitelist updated: ${whitelistString}`);
  }
}
