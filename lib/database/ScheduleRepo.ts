// // import { createClient } from "@supabase/supabase-js";
// import { Schedule } from "@/lib/scheduler/CronScheduler";
// import { v4 as uuidv4 } from "uuid";

//
// export interface ScheduleRecord {
//   id: string;
//   name: string;
//   cron_expression: string;
//   is_active: boolean;
//   data: Record<string, any>;
//   last_run?: Date;
//   next_run?: Date;
//   created_at: Date;
//   updated_at: Date;
// }

// /**
//  * Repository for managing schedules in the database
//  */
// export class ScheduleRepo {
//   // private supabase;
//   private static instance: ScheduleRepo;

//   /**
//    * Private constructor for singleton pattern
//    */
//   private constructor() {
//     // Initialize Supabase client
//     // this.supabase = createClient(
//     //   process.env.SUPABASE_URL!,
//     //   process.env.SUPABASE_KEY!
//     // );
//   }

//   /**
//    * Get the singleton instance of ScheduleRepo
//    */
//   public static getInstance(): ScheduleRepo {
//     if (!ScheduleRepo.instance) {
//       ScheduleRepo.instance = new ScheduleRepo();
//     }
//     return ScheduleRepo.instance;
//   }

//   /**
//    * Convert a database record to a Schedule object
//    */
//   private toSchedule(record: ScheduleRecord): Schedule {
//     return {
//       id: record.id,
//       name: record.name,
//       cronExpression: record.cron_expression,
//       isActive: record.is_active,
//       data: record.data,
//       lastRun: record.last_run,
//       nextRun: record.next_run,
//     };
//   }

//   /**
//    * Convert a Schedule object to a database record
//    */
//   private toRecord(
//     schedule: Schedule
//   ): Omit<ScheduleRecord, "created_at" | "updated_at"> {
//     return {
//       id: schedule.id,
//       name: schedule.name,
//       cron_expression: schedule.cronExpression,
//       is_active: schedule.isActive,
//       data: schedule.data,
//       last_run: schedule.lastRun,
//       next_run: schedule.nextRun,
//     };
//   }

//   /**
//    * Create a new schedule
//    * @param schedule The schedule to create (without ID)
//    * @returns The created schedule with ID
//    */
//   public async create(schedule: Omit<Schedule, "id">): Promise<Schedule> {
//     const id = uuidv4();
//     const newSchedule: Schedule = {
//       ...schedule,
//       id,
//     };

//     const { data, error } = await this.supabase
//       .from("schedules")
//       .insert(this.toRecord(newSchedule));

//     if (error) {
//       throw new Error(`Failed to create schedule: ${error.message}`);
//     }

//     return newSchedule;
//   }

//   /**
//    * Get a schedule by ID
//    * @param id The ID of the schedule to retrieve
//    * @returns The schedule or null if not found
//    */
//   public async getById(id: string): Promise<Schedule | null> {
//     const { data, error } = await this.supabase
//       .from("schedules")
//       .select("*")
//       .eq("id", id)
//       .single();

//     if (error) {
//       if (error.code === "PGRST116") {
//        
//         return null;
//       }
//       throw new Error(`Failed to get schedule: ${error.message}`);
//     }

//     return this.toSchedule(data as ScheduleRecord);
//   }

//   /**
//    * Get all schedules
//    * @param activeOnly Whether to return only active schedules
//    * @returns Array of schedules
//    */
//   public async getAll(activeOnly: boolean = false): Promise<Schedule[]> {
//     let query = this.supabase.from("schedules").select("*");

//     if (activeOnly) {
//       query = query.eq("is_active", true);
//     }

//     const { data, error } = await query;

//     if (error) {
//       throw new Error(`Failed to get schedules: ${error.message}`);
//     }

//     return (data as ScheduleRecord[]).map((record) => this.toSchedule(record));
//   }

//   /**
//    * Update a schedule
//    * @param schedule The schedule to update
//    * @returns The updated schedule
//    */
//   public async update(schedule: Schedule): Promise<Schedule> {
//     const { data, error } = await this.supabase
//       .from("schedules")
//       .update({
//         ...this.toRecord(schedule),
//         updated_at: new Date(),
//       })
//       .eq("id", schedule.id)
//       .select()
//       .single();

//     if (error) {
//       throw new Error(`Failed to update schedule: ${error.message}`);
//     }

//     return this.toSchedule(data as ScheduleRecord);
//   }

//   /**
//    * Delete a schedule
//    * @param id The ID of the schedule to delete
//    * @returns true if deleted, false if not found
//    */
//   // public async delete(id: string): Promise<boolean> {
//   //   const { error } = await this.supabase
//   //     .from("schedules")
//   //     .delete()
//   //     .eq("id", id);

//   //   if (error) {
//   //     if (error.code === "PGRST116") {
//   //       // Record not found
//   //       return false;
//   //     }
//   //     throw new Error(`Failed to delete schedule: ${error.message}`);
//   //   }

//   //   return true;
//   // }

//   /**
//    * Update the last run time of a schedule
//    * @param id The ID of the schedule
//    * @param lastRun The last run time
//    */
//   public async updateLastRun(id: string, lastRun: Date): Promise<void> {
//     const { error } = await this.supabase
//       .from("schedules")
//       .update({
//         last_run: lastRun,
//         updated_at: new Date(),
//       })
//       .eq("id", id);

//     if (error) {
//       throw new Error(`Failed to update last run: ${error.message}`);
//     }
//   }

//   /**
//    * Update the next run time of a schedule
//    * @param id The ID of the schedule
//    * @param nextRun The next run time
//    */
//   public async updateNextRun(id: string, nextRun: Date): Promise<void> {
//     const { error } = await this.supabase
//       .from("schedules")
//       .update({
//         next_run: nextRun,
//         updated_at: new Date(),
//       })
//       .eq("id", id);

//     if (error) {
//       throw new Error(`Failed to update next run: ${error.message}`);
//     }
//   }
// }
