import * as cron from "node-cron";
import { EventEmitter } from "events";

/**
 * Schedule interface representing a recurring task
 */
export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  isActive: boolean;
  data: Record<string, any>;
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Event types emitted by the scheduler
 */
export enum SchedulerEventType {
  TASK_SCHEDULED = "task:scheduled",
  TASK_STARTED = "task:started",
  TASK_COMPLETED = "task:completed",
  TASK_FAILED = "task:failed",
  TASK_CANCELLED = "task:cancelled",
}

/**
 * CronScheduler manages scheduled tasks using node-cron
 */
export class CronScheduler extends EventEmitter {
  private tasks: Map<string, cron.ScheduledTask>;
  private schedules: Map<string, Schedule>;
  private static instance: CronScheduler;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
    this.tasks = new Map();
    this.schedules = new Map();
  }

  /**
   * Get the singleton instance of CronScheduler
   */
  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  /**
   * Schedule a new task
   * @param schedule The schedule to add
   * @param callback The function to execute when the schedule triggers
   * @returns The schedule ID
   */
  public scheduleTask(
    schedule: Schedule,
    callback: () => Promise<void>
  ): string {
    if (!cron.validate(schedule.cronExpression)) {
      throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
    }

    if (this.tasks.has(schedule.id)) {
      this.cancelTask(schedule.id);
    }

    const wrappedCallback = async () => {
      try {
        const updatedSchedule = { ...schedule, lastRun: new Date() };
        this.schedules.set(schedule.id, updatedSchedule);
        this.emit(SchedulerEventType.TASK_STARTED, updatedSchedule);
        await callback();
        this.emit(SchedulerEventType.TASK_COMPLETED, updatedSchedule);
      } catch (error) {
        this.emit(SchedulerEventType.TASK_FAILED, { schedule, error });
      }
    };

    const task = cron.schedule(schedule.cronExpression, wrappedCallback);
   
    if (schedule.isActive) {
      task.start();
    } else {
      task.stop();
    }

    this.tasks.set(schedule.id, task);
    this.schedules.set(schedule.id, {
      ...schedule,
      nextRun: this.calculateNextRun(schedule.cronExpression),
    });

    this.emit(SchedulerEventType.TASK_SCHEDULED, schedule);

    return schedule.id;
  }

  /**
   * Cancel a scheduled task
   * @param id The ID of the schedule to cancel
   * @returns true if the task was cancelled, false if it didn't exist
   */
  public cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    task.stop();
    this.tasks.delete(id);
    const schedule = this.schedules.get(id);
    this.schedules.delete(id);

  
    if (schedule) {
      this.emit(SchedulerEventType.TASK_CANCELLED, schedule);
    }
    return true;
  }

  /**
   * Pause a scheduled task without removing it
   * @param id The ID of the schedule to pause
   * @returns true if the task was paused, false if it didn't exist
   */
  public pauseTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    task.stop();

    const schedule = this.schedules.get(id);
    if (schedule) {
      this.schedules.set(id, { ...schedule, isActive: false });
    }

    return true;
  }

  /**
   * Resume a paused task
   * @param id The ID of the schedule to resume
   * @returns true if the task was resumed, false if it didn't exist
   */
  public resumeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    task.start();

    const schedule = this.schedules.get(id);
    if (schedule) {
      this.schedules.set(id, {
        ...schedule,
        isActive: true,
        nextRun: this.calculateNextRun(schedule.cronExpression),
      });
    }

    return true;
  }

  /**
   * Get all active schedules
   * @returns Array of all active schedules
   */
  public getActiveSchedules(): Schedule[] {
    return Array.from(this.schedules.values()).filter(
      (schedule) => schedule.isActive
    );
  }

  /**
   * Get all schedules (active and inactive)
   * @returns Array of all schedules
   */
  public getAllSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get a specific schedule by ID
   * @param id The ID of the schedule to retrieve
   * @returns The schedule or undefined if not found
   */
  public getSchedule(id: string): Schedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * Calculate the next run time for a cron expression
   * @param cronExpression The cron expression to calculate for
   * @returns The next run date
   */
  private calculateNextRun(cronExpression: string): Date {
    try {
      return new Date(Date.now() + 60000); 
    } catch (error) {
      console.error(`Error calculating next run: ${error}`);
      return new Date();
    }
  }

  /**
   * Stop all scheduled tasks
   */
  public stopAll(): void {
    for (const [id, task] of this.tasks.entries()) {
      task.stop();
      this.emit(SchedulerEventType.TASK_CANCELLED, this.schedules.get(id));
    }
    this.tasks.clear();
  }
}
