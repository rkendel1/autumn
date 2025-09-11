import { notNullish } from "@/utils/genUtils.js";
import {
  Entity,
  EntityWithFeature,
  Feature,
  FullCusEntWithFullCusProduct,
  FullCustomerEntitlement,
} from "@autumn/shared";

export const cusEntMatchesEntity = ({
  cusEnt,
  entity,
  features,
}: {
  cusEnt: FullCusEntWithFullCusProduct;
  entity?: Entity;
  features?: Feature[];
}) => {
  if (!entity) return true;

  let cusProductMatch = true;

  if (notNullish(cusEnt.customer_product?.internal_entity_id)) {
    cusProductMatch =
      cusEnt.customer_product.internal_entity_id === entity.internal_id;
  }

  let entityFeatureIdMatch = true;
  // let feature = features?.find(
  //   (f) => f.id == cusEnt.entitlement.entity_feature_id,
  // );

  if (notNullish(cusEnt.entitlement.entity_feature_id)) {
    entityFeatureIdMatch =
      cusEnt.entitlement.entity_feature_id == entity.feature_id;
  }

  return cusProductMatch && entityFeatureIdMatch;
};

export const cusEntMatchesFeature = ({
  cusEnt,
  feature,
}: {
  cusEnt: FullCustomerEntitlement;
  feature: Feature;
}) => {
  return cusEnt.entitlement.feature.internal_id === feature.internal_id;
};

export const findMainCusEntForFeature = ({
  cusEnts,
  feature,
}: {
  cusEnts: FullCustomerEntitlement[];
  feature: Feature;
}) => {
  let mainCusEnt = cusEnts.find(
    (e: any) => e.entitlement.feature.internal_id === feature.internal_id
  );

  return mainCusEnt;
};

export const findLinkedCusEnts = ({
  cusEnts,
  feature,
}: {
  cusEnts: FullCustomerEntitlement[];
  feature: Feature;
}) => {
  return cusEnts.filter(
    (e: any) => e.entitlement.entity_feature_id === feature.id
  );
};

export const findCusEnt = ({
  feature,
  cusEnts,
  onlyUsageAllowed = false,
  entity,
  features,
}: {
  feature: Feature;
  cusEnts: FullCustomerEntitlement[];
  onlyUsageAllowed?: boolean;
  entity?: Entity;
  features?: Feature[];
}) => {
  return cusEnts.find((ce: any) => {
    let featureMatch =
      ce.entitlement.feature.internal_id === feature.internal_id;

    let entityMatch = cusEntMatchesEntity({ cusEnt: ce, entity, features });

    let usageMatch = onlyUsageAllowed ? ce.usage_allowed : true;

    return featureMatch && entityMatch && usageMatch;
  });
};
