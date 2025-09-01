import type {
	CusProductStatus,
	FullCusProduct,
	UsagePriceConfig,
} from "@autumn/shared";
import { AutumnCli } from "tests/cli/AutumnCli.js";

export const timeout = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const batchSendCountEvents = async ({
	customerId,
	eventCount,
	featureId,
}: {
	customerId: string;
	eventCount: number;
	featureId: string;
}) => {
	const batchEvents = [];
	for (let i = 0; i < eventCount; i++) {
		batchEvents.push(
			AutumnCli.sendEvent({
				customerId: customerId,
				eventName: featureId,
			}),
		);
	}

	await Promise.all(batchEvents);
	await timeout(10000);
};

export const searchCusProducts = ({
	productId,
	cusProducts,
	status,
}: {
	productId: string;
	cusProducts: FullCusProduct[];
	status?: CusProductStatus;
}) => {
	if (!cusProducts) {
		return undefined;
	}
	return cusProducts.find(
		(cusProduct: FullCusProduct) =>
			cusProduct.product.id === productId &&
			(status ? cusProduct.status === status : true),
	);
};

export const getFixedPriceAmount = (product: any) => {
	let amount = 0;
	for (const price of product.prices) {
		if (price.config.type === "fixed") {
			amount += price.config.amount;
		}
	}
	return amount;
};

export const getUsagePriceTiers = ({
	product,
	featureId,
}: {
	product: any;
	featureId: string;
}) => {
	for (const price of product.prices) {
		if (
			price.config.type === "usage" &&
			price.config.feature_id === featureId
		) {
			return price.config.usage_tiers;
		}
	}
	return [];
};

export const getFeaturePrice = ({
	product,
	featureId,
	cusProducts,
	subId,
}: {
	product: any;
	featureId: string;
	cusProducts: FullCusProduct[];
	subId?: string;
}) => {
	if (cusProducts.length === 0) {
		return null;
	}

	const mainProduct = cusProducts[0];

	for (const cusPrice of mainProduct.customer_prices) {
		const price = cusPrice.price;
		if ((price.config! as UsagePriceConfig).feature_id === featureId) {
			return price;
		}
	}

	return null;
};
