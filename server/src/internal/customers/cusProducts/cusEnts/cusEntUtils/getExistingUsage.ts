import {
  CustomerEntitlement,
  CustomerEntitlementSchema,
  EntInterval,
  EntitlementWithFeature,
  Entity,
  Feature,
  FeatureType,
  FullCusEntWithFullCusProduct,
  FullCusProduct,
  Price,
} from "@autumn/shared";

import {
  getRelatedCusPrice,
  getResetBalance,
  getUnlimitedAndUsageAllowed,
} from "../cusEntUtils.js";
import { getEntOptions } from "@/internal/products/prices/priceUtils.js";
import { notNullish, nullish } from "@/utils/genUtils.js";
import { performDeductionOnCusEnt } from "@/trigger/updateBalanceTask.js";
import { sortCusEntsForDeduction } from "@autumn/shared";

export const getExistingCusEntAndUsage = async ({
  curCusProduct,
  entitlement,
  relatedPrice,
}: {
  entitlement: EntitlementWithFeature;
  curCusProduct?: FullCusProduct;
  relatedPrice?: Price;
}) => {
  if (!curCusProduct) {
    return { cusEnt: null, usage: null };
  }

  // 1. If there is only one cus ent, return it and usage
  let similarCusEnts = curCusProduct.customer_entitlements.filter(
    (ce) => ce.internal_feature_id === entitlement.internal_feature_id
    // &&
    //   ce.entitlement.interval === entitlement.interval
  );

  console.log("Entitlement:", entitlement.feature_id, entitlement.interval);
  console.log(
    "Similar entitlements:",
    similarCusEnts.map(
      (ce) =>
        `${ce.entitlement.feature_id} (${ce.entitlement.interval}) (${ce.balance})`
    )
  );

  if (similarCusEnts.length === 1) {
    return { cusEnt: similarCusEnts[0], usage: null };
  }
};

export const getExistingUsages = ({
  curCusProduct,
  entities,
  features,
}: {
  curCusProduct: FullCusProduct;
  entities: Entity[];
  features: Feature[];
}) => {
  let usages: Record<
    string,
    {
      feature_id: string;
      interval: EntInterval;
      interval_count: number;
      usage: number;
      entityUsages: Record<string, number> | null;
      fromEntities: boolean;
    }
  > = {};

  let cusPrices = curCusProduct?.customer_prices || [];

  // Get entityUsage
  for (const entity of entities) {
    let feature = features.find(
      (f) => f.internal_id === entity.internal_feature_id
    );
    let key = `${feature?.id}-${EntInterval.Lifetime}-1`;

    if (!usages[key]) {
      usages[key] = {
        feature_id: feature?.id || "",
        interval: EntInterval.Lifetime,
        interval_count: 1,
        usage: 0,
        entityUsages: null,
        fromEntities: true,
      };
    }

    usages[key].usage += 1;
  }

  for (const cusEnt of curCusProduct?.customer_entitlements || []) {
    let ent = cusEnt.entitlement;
    let key = `${ent.feature_id}-${ent.interval}-${ent.interval_count || 1}`;
    let feature = ent.feature;
    if (feature.type == FeatureType.Boolean) continue;

    let { unlimited, usageAllowed } = getUnlimitedAndUsageAllowed({
      cusEnts: curCusProduct.customer_entitlements,
      internalFeatureId: ent.internal_feature_id!,
    });

    if (unlimited) continue;

    if (!usages[key]) {
      usages[key] = {
        feature_id: feature.id,
        interval: ent.interval || EntInterval.Lifetime,
        interval_count: ent.interval_count || 1,
        usage: 0,
        entityUsages: null,
        fromEntities: false,
      };
    }

    if (usages[key].fromEntities) {
      continue;
    }

    // 1. To check, does ent options work with multiple features?
    let relatedCusPrice = getRelatedCusPrice(cusEnt, cusPrices);
    let options = getEntOptions(curCusProduct.options, ent);

    let resetBalance = getResetBalance({
      entitlement: ent,
      options,
      relatedPrice: relatedCusPrice?.price,
      // productQuantity: curCusProduct.quantity,
    });

    usages[key].usage += resetBalance! - cusEnt.balance!;

    if (notNullish(cusEnt.entities)) {
      if (!usages[key].entityUsages) {
        usages[key].entityUsages = {};
      }

      for (const entityId in cusEnt.entities) {
        if (nullish(usages[key].entityUsages[entityId])) {
          usages[key].entityUsages[entityId] = 0;
        }

        usages[key].entityUsages[entityId] +=
          resetBalance! - cusEnt.entities[entityId].balance!;
      }
    }
  }

  return usages;
};

export const addExistingUsagesToCusEnts = ({
  cusEnts,
  entitlements,
  curCusProduct,
  carryExistingUsages = false,
  printLogs = false,
  isDowngrade = false,
  entities,
  features,
}: {
  cusEnts: CustomerEntitlement[];
  entitlements: EntitlementWithFeature[];
  curCusProduct: FullCusProduct;
  carryExistingUsages?: boolean;
  printLogs?: boolean;
  isDowngrade?: boolean;
  entities: Entity[];
  features: Feature[];
}) => {
  if (isDowngrade) {
    return cusEnts;
  }

  let existingUsages = getExistingUsages({
    curCusProduct,
    entities,
    features,
  });

  let fullCusEnts = cusEnts.map((ce) => {
    let entitlement = entitlements.find((e) => e.id === ce.entitlement_id!);
    return { ...ce, entitlement, customer_product: curCusProduct };
  }) as FullCusEntWithFullCusProduct[];

  // Sort cusEnts
  sortCusEntsForDeduction(fullCusEnts);

  printLogs = false;
  if (printLogs) {
    console.log("DEDUCTING EXISTING USAGE FROM CUS ENTS");
    console.log("Existing usages:", existingUsages);
    console.log(
      "Sorted cusEnts:",
      fullCusEnts.map(
        (ce) =>
          `${ce.entitlement.feature_id} (${ce.entitlement.interval}), balance: ${ce.balance}`
      )
    );
  }

  for (const key in existingUsages) {
    let usage = existingUsages[key].usage;
    let entityUsages = existingUsages[key].entityUsages;

    const {
      feature_id = "",
      interval = "",
      interval_count = 1,
    } = existingUsages[key] || {};

    for (const cusEnt of fullCusEnts) {
      let ent = cusEnt.entitlement;
      // let cusEntKey = `${ent.feature_id}-${ent.interval}-${ent.interval_count || 1}`;
      let fromEntities = existingUsages[key].fromEntities;

      // if (cusEntKey !== key) continue;
      const isSameFeature = cusEnt.feature_id == feature_id;

      if (!isSameFeature) continue;

      let shouldCarry =
        ent.carry_from_previous || carryExistingUsages || fromEntities;

      if (!shouldCarry) continue;

      if (notNullish(entityUsages)) {
        for (const entityId in entityUsages) {
          let { toDeduct, newEntities } = performDeductionOnCusEnt({
            cusEnt,
            toDeduct: entityUsages[entityId],
            allowNegativeBalance: cusEnt.usage_allowed ?? false,
            entityId,
          });

          existingUsages[key].entityUsages![entityId] = toDeduct;

          if (nullish(cusEnt.entities![entityId])) {
            cusEnt.entities![entityId] = {
              id: entityId,
              balance: 0,
              adjustment: 0,
            };
          }

          cusEnt.entities![entityId]!.balance = newEntities![entityId]!.balance;
        }
      } else {
        let { newBalance, toDeduct } = performDeductionOnCusEnt({
          cusEnt,
          toDeduct: usage,
          allowNegativeBalance: cusEnt.usage_allowed ?? false,
        });
        usage = toDeduct;
        cusEnt.balance = newBalance;
      }

      if (printLogs) {
        console.log("--------------------------------");
        console.log("Key:", key);
        console.log("New cus ent balance:", cusEnt.balance, cusEnt.entities);
        console.log("Existing usages:", existingUsages);
      }
    }
  }

  // console.log("Full cusEnts:", fullCusEnts);
  return fullCusEnts.map((ce) => CustomerEntitlementSchema.parse(ce));
};
