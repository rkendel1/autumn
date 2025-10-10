import {
	AllowanceType,
	type AppEnv,
	CusProductStatus,
	type Customer,
	customerEntitlements,
	customers,
	ErrCode,
	type Feature,
	FeatureType,
	type FullCustomerEntitlement,
	type Organization,
	RecaseError,
} from "@autumn/shared";
import { Decimal } from "decimal.js";
import type { DrizzleCli } from "@/db/initDrizzle.js";
import { CusService } from "@/internal/customers/CusService.js";
import { refreshCusCache } from "@/internal/customers/cusCache/updateCachedCus.js";
import { getFeatureBalance } from "@/internal/customers/cusProducts/cusEnts/cusEntUtils.js";
import { deductFromApiCusRollovers } from "@/internal/customers/cusProducts/cusEnts/cusRollovers/rolloverDeductionUtils.js";
import { getCusEntsInFeatures } from "@/internal/customers/cusUtils/cusUtils.js";
import { featureToCreditSystem } from "@/internal/features/creditSystemUtils.js";
import { handleThresholdReached } from "./handleThresholdReached.js";
import {
	deductAllowanceFromCusEnt,
	deductFromUsageBasedCusEnt,
} from "./updateBalanceTask.js";
import { DrizzleError, eq, sql, TransactionRollbackError } from "drizzle-orm";

// 2. Get deductions for each feature
const getFeatureDeductions = ({
	cusEnts,
	value,
	features,
	shouldSet,
}: {
	cusEnts: FullCustomerEntitlement[];
	value: number;
	features: Feature[];
	shouldSet: boolean;
}) => {
	const meteredFeature =
		features.find((f) => f.type === FeatureType.Metered) || features[0];

	const featureDeductions = [];
	for (const feature of features) {
		let newValue = value;
		const unlimitedExists = cusEnts.some(
			(cusEnt) =>
				cusEnt.entitlement.allowance_type === AllowanceType.Unlimited &&
				cusEnt.entitlement.internal_feature_id === feature.internal_id,
		);

		if (unlimitedExists) {
			continue;
		}

		if (feature.type === FeatureType.CreditSystem) {
			newValue = featureToCreditSystem({
				featureId: meteredFeature.id,
				creditSystem: feature,
				amount: value,
			});
		}

		// If it's set
		let deduction = newValue;

		if (shouldSet) {
			const totalAllowance = cusEnts.reduce((acc, curr) => {
				return acc + (curr.entitlement.allowance || 0);
			}, 0);

			const targetBalance = new Decimal(totalAllowance).sub(value).toNumber();

			const totalBalance = getFeatureBalance({
				cusEnts,
				internalFeatureId: feature.internal_id!,
			})!;

			deduction = new Decimal(totalBalance).sub(targetBalance).toNumber();
		}

		if (deduction === 0) {
			console.log(`   - Skipping feature ${feature.id} -- deduction is 0`);
			continue;
		}

		featureDeductions.push({
			feature,
			deduction,
		});
	}

	featureDeductions.sort((a, b) => {
		if (
			a.feature.type === FeatureType.CreditSystem &&
			b.feature.type !== FeatureType.CreditSystem
		) {
			return 1;
		}

		if (
			a.feature.type !== FeatureType.CreditSystem &&
			b.feature.type === FeatureType.CreditSystem
		) {
			return -1;
		}

		return a.feature.id.localeCompare(b.feature.id);
	});

	return featureDeductions;
};

const logUsageUpdate = ({
	customer,
	features,
	cusEnts,
	featureDeductions,
	org,
	setUsage,
	entityId,
}: {
	customer: Customer;
	features: Feature[];
	cusEnts: FullCustomerEntitlement[];
	featureDeductions: any;
	org: Organization;
	setUsage: boolean;
	entityId?: string;
}) => {
	console.log(
		`   - Customer: ${customer.id} (${customer.env}) | Org: ${
			org.slug
		} | Features: ${features.map((f) => f.id).join(", ")} | Set Usage: ${
			setUsage ? "true" : "false"
		}`,
	);

	console.log(
		"   - CusEnts:",
		cusEnts.map((cusEnt: any) => {
			let balanceStr = cusEnt.balance;
			try {
				if (cusEnt.entitlement.allowance_type === AllowanceType.Unlimited) {
					balanceStr = "Unlimited";
				}
			} catch (error) {
				balanceStr = "failed_to_get_balance";
			}

			if (entityId && cusEnt.entities) {
				balanceStr = `${cusEnt.entities?.[entityId!]?.balance} [${entityId}]`;
			}

			return `${cusEnt.feature_id} - ${balanceStr} (${
				cusEnt.customer_product ? cusEnt.customer_product.product_id : ""
			})`;
		}),
		"| Deductions:",
		featureDeductions.map((f: any) => `${f.feature.id}: ${f.deduction}`),
	);
};

// Main function to update customer balance
export const updateUsage = async ({
	db,
	customerId,
	features,
	org,
	env,
	value,
	properties,
	setUsage,
	logger,
	entityId,
	allFeatures,
	throwOnDeductionFailed = false,
}: {
	db: DrizzleCli;
	customerId: string;
	features: Feature[];
	org: Organization;
	env: AppEnv;
	value: number;
	properties: any;
	setUsage: boolean;
	logger: any;
	entityId?: string;
	allFeatures: Feature[];
	throwOnDeductionFailed?: boolean;
}) => {

	return await db.transaction(async (tx) => {
		// Lock ALL customer entitlements for this customer using JOIN
		await tx.execute(sql`
			SELECT ce.* 
			FROM ${customerEntitlements} ce
			INNER JOIN ${customers} c ON ce.internal_customer_id = c.internal_id
			WHERE c.id = ${customerId} 
				AND c.org_id = ${org.id}
				AND c.env = ${env}
			FOR UPDATE OF ce
		`);

	const customer = await CusService.getFull({
		db: tx as unknown as DrizzleCli,
		idOrInternalId: customerId,
		orgId: org.id,
		env,
		inStatuses: [CusProductStatus.Active, CusProductStatus.PastDue],
		entityId,
		withSubs: true,
	});

	const { cusEnts, cusPrices } = await getCusEntsInFeatures({
		customer,
		internalFeatureIds: features.map((f) => f.internal_id!),
		logger,
		reverseOrder: org.config?.reverse_deduction_order,
	});

	// 1. Get deductions for each feature
	const featureDeductions = getFeatureDeductions({
		cusEnts,
		value,
		shouldSet: setUsage,
		features,
	});

	logUsageUpdate({
		customer,
		features,
		cusEnts,
		featureDeductions,
		org,
		setUsage,
		entityId,
	});

	// 3. Return if no customer entitlements or features found
	if (cusEnts.length === 0 || features.length === 0) {
		console.log("   - No customer entitlements or features found");
		return;
	}

	const originalCusEnts = structuredClone(cusEnts);
	for (const obj of featureDeductions) {
		let { feature, deduction: toDeduct } = obj;

		for (const cusEnt of cusEnts) {
			if (cusEnt.entitlement.internal_feature_id !== feature.internal_id) {
				continue;
			}

			toDeduct = await deductFromApiCusRollovers({
				toDeduct,
				cusEnt,
				deductParams: {
					db: tx as unknown as DrizzleCli,
					feature,
					env,
					entity: customer.entity ? customer.entity : undefined,
				},
			});

			if (toDeduct === 0) continue;

			toDeduct = await deductAllowanceFromCusEnt({
				toDeduct,
				cusEnt,
				deductParams: {
					db: tx as unknown as DrizzleCli,
					feature,
					env,
					org,
					cusPrices: cusPrices as any[],
					customer,
					properties,
					entity: customer.entity,
				},
				featureDeductions,
				willDeductCredits: true,
				setZeroAdjustment: true,
			});
		}

		if (toDeduct !== 0) {
			const canFeatureDeduct = await deductFromUsageBasedCusEnt({
				toDeduct,
				cusEnts,
				deductParams: {
					db: tx as unknown as DrizzleCli,
					feature,
					env,
					org,
					cusPrices: cusPrices as any[],
					customer,
					properties,
					entity: customer.entity,
				},
				setZeroAdjustment: true,
				shouldReturnSuccess: true,
			});
			if(canFeatureDeduct === false && throwOnDeductionFailed) {
				// throws TransactionRollbackError
				tx.rollback()
			}
		}

		handleThresholdReached({
			org,
			env,
			features: allFeatures,
			db,

			feature,
			cusEnts: originalCusEnts,
			newCusEnts: cusEnts,
			fullCus: customer,
			logger,
		});
	}
})
};

// MAIN FUNCTION
export const runUpdateUsageTask = async ({
	payload,
	logger,
	db,
	throwError = false,
}: {
	payload: any;
	logger: any;
	db: DrizzleCli;
	throwError?: boolean;
}) => {
	try {
		// 1. Update customer balance
		const {
			internalCustomerId,
			customerId,
			eventId,
			features,
			value,
			set_usage,
			properties,
			org,
			env,
			entityId,
			allFeatures,
		} = payload;

		console.log("--------------------------------");
		console.log(
			`HANDLING USAGE TASK FOR CUSTOMER (${customerId}), ORG: ${org.slug}, EVENT ID: ${eventId}`,
		);

		await updateUsage({
			db,
			customerId,
			features,
			value,
			properties,
			org,
			env,
			setUsage: set_usage,
			logger,
			entityId,
			allFeatures,
			throwOnDeductionFailed: true,
		});

		await refreshCusCache({
			db,
			customerId,
			entityId,
			org,
			env,
		});
		console.log("   ✅ Customer balance updated");

	} catch (error) {
		if(error instanceof TransactionRollbackError) {
			console.log("   ❌ Customer balance could not be updated");
			return;
		}
		logger.error(`ERROR UPDATING USAGE`);
		logger.error(error);

		if (throwError) {
			throw error;
		}
	}
};
