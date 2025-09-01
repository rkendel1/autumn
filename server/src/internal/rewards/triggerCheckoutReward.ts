import { RewardCategory, RewardTriggerEvent } from "@autumn/shared";
import type { DrizzleCli } from "@/db/initDrizzle.js";
import { createStripeCli } from "@/external/stripe/utils.js";
import { RewardProgramService } from "../rewards/RewardProgramService.js";
import { RewardRedemptionService } from "./RewardRedemptionService.js";
import { triggerFreeProduct, triggerRedemption } from "./referralUtils.js";
import { getRewardCat } from "./rewardUtils.js";
export const runTriggerCheckoutReward = async ({
	db,
	payload,
	logger,
}: {
	db: DrizzleCli;
	payload: any;
	logger: any;
}) => {
	try {
		// Customer redeeming code, product they're buying
		const { customer, product, org, env, subId } = payload;

		const stripeCli = createStripeCli({
			org,
			env,
		});

		// 1. Check if redemption exists
		const redemptions = await RewardRedemptionService.getByCustomer({
			db,
			internalCustomerId: customer.internal_id, // customer that redeemed code
			withRewardProgram: true,
			triggered: false,
			withReferralCode: true,
			triggerWhen: RewardTriggerEvent.Checkout,
		});

		for (const redemption of redemptions) {
			if (
				!redemption ||
				redemption.reward_program.when !== RewardTriggerEvent.Checkout
			) {
				return;
			}

			const { reward_program, referral_code: referralCode } = redemption;
			const { reward } = reward_program;

			logger.info(`--------------------------------`);
			logger.info(`CHECKING FOR CHECKOUT REWARD, ORG: ${org.slug}`);
			logger.info(
				`Redeemed by: ${customer.name} (${customer.id}) for referral program: ${reward_program.id}`,
			);
			logger.info(`Referral code: ${referralCode.code} (${referralCode.id})`);

			if (!reward_program.product_ids.includes(product.id)) {
				logger.info(
					`Product ${product.name} (${product.id}) not included in referral program, skipping`,
				);
				return;
			}

			// Check for trial
			let hasTrial = false;
			if (subId) {
				const sub = await stripeCli.subscriptions.retrieve(subId);
				// hasTrial = Boolean(sub.trial_end && sub.trial_end > Date.now());
				hasTrial = sub.status === "trialing";
			}

			if (hasTrial) {
				logger.info(`Subscription is on trial, not triggering reward`);
				return;
			}

			// Get redemption count
			const redemptionCount = await RewardProgramService.getCodeRedemptionCount(
				{
					db,
					referralCodeId: referralCode.id,
				},
			);

			if (redemptionCount >= reward_program.max_redemptions) {
				logger.info(
					`Max redemptions reached, not triggering latest redemption`,
				);
				return;
			}

			const rewardCat = getRewardCat(reward);
			if (rewardCat === RewardCategory.FreeProduct) {
				await triggerFreeProduct({
					db,
					referralCode,
					redeemer: customer,
					rewardProgram: reward_program,
					org,
					env,
					logger,
					redemption,
				});
			} else {
				await triggerRedemption({
					db,
					referralCode,
					org,
					env,
					logger,
					reward,
					redemption,
				});
			}
		}
	} catch (error) {
		logger.error("Failed to trigger checkout reward");
		logger.error(error);
	}
};
