import { AppEnv } from "@autumn/shared";
import { OrgService } from "../OrgService.js";
import { CacheManager } from "@/external/caching/CacheManager.js";
import { CacheType } from "@/external/caching/cacheActions.js";
import { DrizzleCli } from "@/db/initDrizzle.js";

export const clearOrgCache = async ({
	db,
	orgId,
	env,
	logger = console,
}: {
	db: DrizzleCli;
	orgId: string;
	env?: AppEnv;
	logger?: any;
}) => {
	// 1. Get all hashed secret key and public key for org
	try {
		let org = await OrgService.getWithKeys({
			db,
			orgId,
			env,
		});

		if (!org) {
			return;
		}

		let secretKeys = org.api_keys.map((key: any) => key.hashed_key);
		let publicKeys = [org.test_pkey, org.live_pkey];

		let batchDelete = [];
		for (let key of secretKeys) {
			batchDelete.push(
				CacheManager.invalidate({
					action: CacheType.SecretKey,
					value: key!,
				}),
			);
		}

		for (let key of publicKeys) {
			batchDelete.push(
				CacheManager.invalidate({
					action: CacheType.PublicKey,
					value: key!,
				}),
			);
		}

		await Promise.all(batchDelete);
		logger.info(`Cleared cache for org ${org.slug} (${orgId})`);
	} catch (error) {
		logger.error(`Failed to clear cache for org ${orgId}`);
		logger.error(error);
	}
};
