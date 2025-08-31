import { DrizzleCli } from "@/db/initDrizzle.js";
import { PriceService } from "../PriceService.js";
import { FixedPriceConfig, prices, PriceType } from "@autumn/shared";
import { eq } from "drizzle-orm";
import { generateId } from "@/utils/genUtils.js";
import { Price, UsagePriceConfig } from "@autumn/shared";

export const copyPrice = async ({
  db,
  priceId,
  usagePriceConfig,
  fixedPriceConfig,
  isCustom,
  withPrevConfig = true,
}: {
  db: DrizzleCli;
  priceId: string;
  usagePriceConfig?: Partial<UsagePriceConfig>;
  fixedPriceConfig?: Partial<FixedPriceConfig>;
  isCustom?: boolean;
  withPrevConfig?: boolean;
}) => {
  let price = (await db.query.prices.findFirst({
    where: eq(prices.id, priceId),
  })) as Price;

  let newPrice = structuredClone(price);

  newPrice = {
    ...newPrice,
    id: generateId("pr"),
    created_at: Date.now(),
    is_custom: isCustom || newPrice.is_custom,
  };

  if (fixedPriceConfig) {
    newPrice = {
      ...newPrice,
      entitlement_id: null,
      config: {
        ...(withPrevConfig ? (newPrice.config as FixedPriceConfig) : {}),
        type: PriceType.Fixed,
        ...fixedPriceConfig,
      } as FixedPriceConfig,
    };
  }

  if (usagePriceConfig) {
    newPrice = {
      ...newPrice,
      config: {
        ...(newPrice.config as UsagePriceConfig),
        ...usagePriceConfig,
      },
    };
  }

  return newPrice;
};
