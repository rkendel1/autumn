import {
	AttachParams,
	InsertCusProductParams,
} from "@/internal/customers/cusProducts/AttachParams.js";
import {
	cusProductToEnts,
	cusProductToPrices,
	cusProductToProduct,
} from "@/internal/customers/cusProducts/cusProductUtils/convertCusProduct.js";
import { newCusToFullCus } from "@/internal/customers/cusUtils/cusUtils.js";
import { ExtendedRequest } from "@/utils/models/Request.js";
import {
	Customer,
	Entity,
	FullCusProduct,
	FullCustomer,
	FullProduct,
	FreeTrial,
} from "@autumn/shared";
import Stripe from "stripe";

export const webhookToAttachParams = ({
	req,
	stripeCli,
	paymentMethod,
	cusProduct,
	fullCus,
	entities,
}: {
	req: ExtendedRequest;
	stripeCli: Stripe;
	paymentMethod?: Stripe.PaymentMethod | null;
	cusProduct: FullCusProduct;
	fullCus: FullCustomer;
	entities?: Entity[];
}): AttachParams => {
	const fullProduct = cusProductToProduct({ cusProduct });

	const params: AttachParams = {
		stripeCli,
		paymentMethod,
		customer: fullCus,
		org: req.org,
		products: [fullProduct],
		prices: cusProductToPrices({ cusProduct }),
		entitlements: cusProductToEnts({ cusProduct }),
		features: req.features,
		freeTrial: cusProduct.free_trial || null,
		optionsList: cusProduct.options,
		cusProducts: [cusProduct],

		internalEntityId: cusProduct.internal_entity_id || undefined,
		entities: entities || [],
		replaceables: [],
	};

	return params;
};

export const productToInsertParams = ({
	req,
	fullCus,
	newProduct,
	entities,
}: {
	req: ExtendedRequest;
	fullCus: FullCustomer;
	newProduct: FullProduct;
	entities?: Entity[];
}): InsertCusProductParams => {
	const params: InsertCusProductParams = {
		customer: fullCus,
		org: req.org,
		product: newProduct,
		prices: newProduct.prices,
		entitlements: newProduct.entitlements,
		features: req.features,
		cusProducts: fullCus.customer_products,
		freeTrial: null,
		optionsList: [],
		internalEntityId: undefined,
		entities: entities || [],
		replaceables: [],
	};

	return params;
};

export const newCusToAttachParams = ({
	req,
	newCus,
	products,
	stripeCli,
	freeTrial = null,
}: {
	req: ExtendedRequest;
	newCus: FullCustomer;
	products: FullProduct[];
	stripeCli: Stripe;
	freeTrial?: FreeTrial | null;
}) => {
	if (!newCus.customer_products) {
		newCus.customer_products = [];
	}

	if (!newCus.entities) {
		newCus.entities = [];
	}

	const attachParams: AttachParams = {
		stripeCli,
		paymentMethod: null,
		req,
		org: req.org,
		customer: newCus,
		products,
		prices: products.flatMap((p) => p.prices),
		entitlements: products.flatMap((p) => p.entitlements),
		freeTrial,
		replaceables: [],
		optionsList: [],
		cusProducts: [],
		entities: [],
		features: [],
		invoiceOnly: true,
	};
	return attachParams;
};

export const newCusToInsertParams = ({
	req,
	newCus,
	product,
	freeTrial = null,
}: {
	req: ExtendedRequest;
	newCus: Customer;
	product: FullProduct;
	freeTrial?: FreeTrial | null;
}) => {
	return {
		req,
		org: req.org,
		customer: newCusToFullCus({ newCus }),
		product,
		prices: product.prices,
		entitlements: product.entitlements,
		replaceables: [],
		freeTrial,
		optionsList: [],
		cusProducts: [],
		entities: [],
		features: [],
	} satisfies InsertCusProductParams;
};
