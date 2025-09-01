import { z } from "zod";
import {
	PriceTierSchema,
	ProductItemFeatureType,
	ProductItemInterval,
	ProductItemType,
	UsageModel,
} from "./productItemModels.js";
import { Infinite } from "../../productModels/productEnums.js";
import { APIFeatureSchema } from "../../featureModels/featureResModels.js";

export const ProductItemResponseSchema = z.object({
	// Feature stuff
	type: z.nativeEnum(ProductItemType).nullish(),
	feature_id: z.string().nullish(),
	feature_type: z.nativeEnum(ProductItemFeatureType).nullish(),

	// Feature response
	feature: APIFeatureSchema.nullish(),

	included_usage: z.number().or(z.literal(Infinite)).nullish(),
	interval: z.nativeEnum(ProductItemInterval).nullish(),
	interval_count: z.number().nullish(),

	// Price config
	price: z.number().nullish(),
	tiers: z.array(PriceTierSchema).nullish(),
	usage_model: z.nativeEnum(UsageModel).nullish(),
	billing_units: z.number().nullish(), // amount per billing unit (eg. $9 / 250 units)
	reset_usage_when_enabled: z.boolean().nullish(),
	quantity: z.number().nullish(),
	next_cycle_quantity: z.number().nullish(),
	entity_feature_id: z.string().nullish(),

	display: z
		.object({
			primary_text: z.string(),
			secondary_text: z.string().nullish(),
		})
		.nullish(),
});

export type ProductItemResponse = z.infer<typeof ProductItemResponseSchema>;
