import dotenv from "dotenv";
dotenv.config();

import { AppEnv } from "@autumn/shared";
import { clearOrg, setupOrg } from "tests/utils/setup.js";
import {
	features,
	products,
	creditSystems,
	advanceProducts,
	attachProducts,
	rewards,
	oneTimeProducts,
	entityProducts,
	referralPrograms,
} from "./global.js";
import { initDrizzle } from "@/db/initDrizzle.js";

const ORG_SLUG = process.env.TESTS_ORG!;
const DEFAULT_ENV = AppEnv.Sandbox;

import { Hyperbrowser } from "@hyperbrowser/sdk";
const hyperbrowser = new Hyperbrowser({
	apiKey: process.env.HYPERBROWSER_API_KEY,
});

describe("Initialize org for tests", () => {
	it("should initialize org", async function () {
		this.timeout(1000000000);
		this.org = await clearOrg({ orgSlug: ORG_SLUG, env: DEFAULT_ENV });
		this.env = DEFAULT_ENV;
		let { db, client } = initDrizzle();

		this.db = db;
		this.client = client;

		await setupOrg({
			orgId: this.org.id,
			env: DEFAULT_ENV,
			features: { ...features, ...creditSystems } as any,
			products: {
				...products,
				...advanceProducts,
				...attachProducts,
				...oneTimeProducts,
				...entityProducts,
			} as any,
			rewards: { ...rewards } as any,
			rewardTriggers: { ...referralPrograms } as any,
		});

		console.log("--------------------------------");
	});
});

// after(async function () {
//   await this.client.end();
// });
