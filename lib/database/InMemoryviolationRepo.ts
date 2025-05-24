// import { Violation } from "../../modules/autoModeration/domain/Violation";
// import { IViolationRepository } from "./repositories/ViolationRepo";

// /**
//  * In-memory implementation of the Violation repository.
//  * Use this for testing or as a temporary solution before implementing a real database.
//  */
// export class InMemoryViolationRepository implements IViolationRepository {
//   private violations: Map<string, Violation> = new Map();
//   private nextId: number = 1;

//   async saveOrUpdate(violation: Violation): Promise<Violation> {
//     const existingViolation = await this.findByUserId(violation.userId);

//     if (existingViolation) {
//       const updatedViolation = new Violation(
//         violation.userId,
//         violation.badgeCount,
//         violation.banned,
//         violation.timestamp,
//         existingViolation.id
//       );

//       this.violations.set(violation.userId, updatedViolation);
//       return updatedViolation;
//     }

//     const newViolation = new Violation(
//       violation.userId,
//       violation.badgeCount,
//       violation.banned,
//       violation.timestamp,
//       `violation_${this.nextId++}`
//     );

//     this.violations.set(violation.userId, newViolation);
//     return newViolation;
//   }

//   async findByUserId(userId: string): Promise<Violation | null> {
//     return this.violations.get(userId) || null;
//   }

//   async findAllBanned(): Promise<Violation[]> {
//     return Array.from(this.violations.values()).filter(
//       (violation) => violation.banned
//     );
//   }

//   async deleteByUserId(userId: string): Promise<boolean> {
//     return this.violations.delete(userId);
//   }
// }
