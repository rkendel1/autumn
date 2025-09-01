import type { AttachBody, AttachBranch, PreviewLineItem } from "@autumn/shared";
import { Decimal } from "decimal.js";
import type Stripe from "stripe";
import {
	getEarliestPeriodEnd,
	getLatestPeriodStart,
} from "@/external/stripe/stripeSubUtils/convertSubUtils.js";
import { freeTrialToStripeTimestamp } from "@/internal/products/free-trials/freeTrialUtils.js";
import { addIntervalForProration } from "@/internal/products/prices/billingIntervalUtils.js";
import { getLargestInterval } from "@/internal/products/prices/priceUtils/priceIntervalUtils.js";
import { notNullish } from "@/utils/genUtils.js";
import type { ExtendedRequest } from "@/utils/models/Request.js";
import type { AttachParams } from "../../cusProducts/AttachParams.js";
import { cusProductsToPrices } from "../../cusProducts/cusProductUtils/convertCusProduct.js";
import { getAddAndRemoveProducts } from "../attachFunctions/multiAttach/getAddAndRemoveProducts.js";
import { priceToNewPreviewItem } from "../attachPreviewUtils/priceToNewPreviewItem.js";
import { priceToUnusedPreviewItem } from "../attachPreviewUtils/priceToUnusedPreviewItem.js";
import { getCustomerSub } from "../attachUtils/convertAttachParams.js";
import { handleMultiAttachErrors } from "../attachUtils/handleAttachErrors/handleMultiAttachErrors.js";

export const getMultiAttachPreview = async ({
	req,
	attachBody,
	attachParams,
	logger,
	config,
	branch,
}: {
	req: ExtendedRequest;
	attachBody: AttachBody;
	attachParams: AttachParams;
	logger: any;
	config: any;
	branch: AttachBranch;
}) => {
	await handleMultiAttachErrors({ attachParams, attachBody, branch });

	const { customer } = attachParams;
	const cusProducts = customer.customer_products;
	const { sub } = await getCustomerSub({ attachParams });

	const items: PreviewLineItem[] = [];
	const subItems = sub?.items.data || [];

	// 1. Get remove cus products...
	const { expireCusProducts } = await getAddAndRemoveProducts({
		attachParams,
		config,
	});

	const prices = cusProductsToPrices({ cusProducts: expireCusProducts });

	for (const price of prices) {
		const cusProduct = cusProducts.find(
			(cp) => cp.internal_product_id === price.internal_product_id,
		)!;

		const previewLineItem = priceToUnusedPreviewItem({
			price,
			stripeItems: subItems,
			cusProduct,
			now: attachParams.now!,
			org: attachParams.org,
			latestInvoice: sub?.latest_invoice as Stripe.Invoice,
			subDiscounts: (sub?.discounts ?? []) as Stripe.Discount[],
		});

		if (!previewLineItem) continue;

		items.push(previewLineItem);
	}

	const productList = attachParams.productsList!;
	const newItems: PreviewLineItem[] = [];
	const itemsWithoutTrial: PreviewLineItem[] = [];

	for (const productOptions of productList) {
		const product = attachParams.products.find(
			(p) => p.id === productOptions.product_id,
		)!;

		// Anchor to unix...
		let anchorToUnix;
		if (sub) {
			const latestPeriodStart = getLatestPeriodStart({ sub });
			const largestInterval = getLargestInterval({ prices: product.prices });
			if (largestInterval) {
				anchorToUnix = addIntervalForProration({
					unixTimestamp: latestPeriodStart * 1000,
					intervalConfig: largestInterval,
				});
			}
		}

		if (config.disableTrial) {
			attachParams.freeTrial = null;
		}

		const onTrial =
			notNullish(attachParams?.freeTrial) || sub?.status === "trialing";

		// How to tell if sub discount will apply to a certain price...

		for (const price of product.prices) {
			const newItem = priceToNewPreviewItem({
				org: attachParams.org,
				price,
				entitlements: product.entitlements,
				skipOneOff: false,
				now: attachParams.now!,
				anchorToUnix,
				productQuantity: productOptions.quantity ?? 1,
				product,
				onTrial,
				rewards: attachParams.rewards,
				subDiscounts: (sub?.discounts ?? []) as Stripe.Discount[],
			});
			const noTrialItem = priceToNewPreviewItem({
				org: attachParams.org,
				price,
				entitlements: product.entitlements,
				skipOneOff: false,
				now: attachParams.now!,
				// anchorToUnix,
				productQuantity: productOptions.quantity ?? 1,
				product,
				onTrial: false,
				rewards: attachParams.rewards,
				subDiscounts: (sub?.discounts ?? []) as Stripe.Discount[],
			});

			if (newItem) {
				newItems.push(newItem);
			}
			if (noTrialItem) {
				itemsWithoutTrial.push(noTrialItem);
			}
		}
	}

	const totalDueToday = newItems.reduce(
		(acc, item) => acc + (item.amount ?? 0),
		0,
	);

	const freeTrial = attachParams.freeTrial;
	let dueNextCycle;
	if (freeTrial || sub?.status === "trialing") {
		const nextCycleAt = freeTrial
			? freeTrialToStripeTimestamp({ freeTrial, now: attachParams.now })! * 1000
			: sub
				? getEarliestPeriodEnd({ sub }) * 1000
				: undefined;

		if (nextCycleAt) {
			dueNextCycle = {
				line_items: itemsWithoutTrial,
				due_at: nextCycleAt,
			};
		}
	}

	return {
		// items,
		due_today: {
			line_items: [...items, ...newItems],
			total: new Decimal(totalDueToday).toNumber(),
		},
		due_next_cycle: dueNextCycle,
	};

	// for (const cusProduct of cusProducts) {
	//   const prices = cusProductToPrices({ cusProduct });

	//   for (const price of prices) {
	//     const previewLineItem = priceToUnusedPreviewItem({
	//       price,
	//       stripeItems: subItems,
	//       cusProduct,
	//     });

	//     if (!previewLineItem) continue;

	//     items.push(previewLineItem);
	//   }
	// }
};
