import {
	type FullCustomerEntitlement,
	type Rollover,
	rollovers,
} from "@autumn/shared";
import { and, eq, gte, inArray } from "drizzle-orm";
import { buildConflictUpdateColumns } from "@/db/dbUtils.js";
import type { DrizzleCli } from "@/db/initDrizzle.js";
import { performMaximumClearing } from "./rolloverUtils.js";

export class RolloverService {
	static async update({
		db,
		id,
		updates,
	}: {
		db: DrizzleCli;
		id: string;
		updates: Partial<Rollover>;
	}) {
		if (!updates.balance && !updates.entities) return [];

		const data = await db
			.update(rollovers)
			.set(updates as any)
			.where(eq(rollovers.id, id))
			.returning();

		return data;
	}

	static async upsert({ db, rows }: { db: DrizzleCli; rows: Rollover[] }) {
		if (Array.isArray(rows) && rows.length === 0) return;

		const updateColumns = buildConflictUpdateColumns(rollovers, ["id"]);
		await db
			.insert(rollovers)
			.values(rows as any)
			.onConflictDoUpdate({
				target: rollovers.id,
				set: updateColumns,
			});
	}

	// static async bulkUpdate({ db, rows }: { db: DrizzleCli; rows: Rollover[] }) {
	//   if (rows.length === 0) return [];

	//   const results = [];
	//   for (const row of rows) {
	//     const result = await this.update({
	//       db,
	//       id: row.id,
	//       updates: row,
	//     });
	//     results.push(...result);
	//   }
	//   return results;
	// }

	static async getCurrentRollovers({
		db,
		cusEntID,
	}: {
		db: DrizzleCli;
		cusEntID: string;
	}) {
		return await db
			.select()
			.from(rollovers)
			.where(
				and(
					eq(rollovers.cus_ent_id, cusEntID),
					gte(rollovers.expires_at, Date.now()),
				),
			);
	}

	static async insert({
		db,
		rows,
		// rolloverConfig,
		fullCusEnt,
		// cusEntID,
		// entityMode,
	}: {
		db: DrizzleCli;
		rows: Rollover[];
		// rolloverConfig: RolloverConfig;
		fullCusEnt: FullCustomerEntitlement;
		// cusEntID: string;
		// entityMode: boolean;
	}) {
		if (rows.length === 0) return {};

		await db
			.insert(rollovers)
			.values(rows as any)
			.returning();

		let curRollovers = [...fullCusEnt.rollovers, ...rows];

		const { toDelete, toUpdate } = performMaximumClearing({
			rows: curRollovers as Rollover[],
			cusEnt: fullCusEnt,
		});

		if (toDelete.length > 0) {
			await RolloverService.delete({ db, ids: toDelete });
		}

		if (toUpdate.length > 0) {
			await RolloverService.upsert({ db, rows: toUpdate });
		}

		// Return latest rollovers...?
		curRollovers = curRollovers.filter((r) => toDelete.includes(r.id));
		curRollovers = curRollovers.map((r) => {
			const updatedRow = toUpdate.find((u) => u.id === r.id);
			if (updatedRow) {
				return updatedRow;
			}
			return r;
		});

		return curRollovers;
	}

	static async delete({ db, ids }: { db: DrizzleCli; ids: string[] }) {
		if (ids.length === 0) return;
		const _data = await db.delete(rollovers).where(inArray(rollovers.id, ids));
	}
}
