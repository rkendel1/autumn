import {
  ACTIVE_STATUSES,
  APIVersion,
  CusProductResponse,
  Entity,
  Feature,
  Organization,
} from "@autumn/shared";
import { getCusProductResponse } from "./getCusProductResponse.js";

const mergeCusProductResponses = ({
  cusProductResponses,
}: {
  cusProductResponses: CusProductResponse[];
}) => {
  const getProductKey = (product: CusProductResponse) => {
    let status = ACTIVE_STATUSES.includes(product.status)
      ? "active"
      : product.status;
    return `${product.id}:${status}`;
  };

  const record: Record<string, any> = {};

  for (const curr of cusProductResponses) {
    const key = getProductKey(curr);
    const latest = record[key];

    const currStartedAt = curr.started_at;

    record[key] = {
      ...(latest || curr),
      version: Math.max(latest?.version || 1, curr?.version || 1),
      canceled_at: curr.canceled_at
        ? curr.canceled_at
        : latest?.canceled_at || null,
      started_at: latest?.started_at
        ? Math.min(latest?.started_at, currStartedAt)
        : currStartedAt,
      quantity: (latest?.quantity || 0) + (curr?.quantity || 0),
    };
  }

  return Object.values(record);
};

export const processFullCusProducts = async ({
  fullCusProducts,
  subs,
  org,
  entities = [],
  apiVersion,
  features,
}: {
  fullCusProducts: any;
  subs: any;
  org: Organization;
  entities?: Entity[];
  apiVersion: number;
  features: Feature[];
}) => {
  // Process full cus products
  let main = [];
  let addOns = [];
  for (const cusProduct of fullCusProducts) {
    let processed = await getCusProductResponse({
      cusProduct,
      subs,
      org,
      entities,
      apiVersion,
      features,
    });

    let isAddOn = cusProduct.product.is_add_on;
    if (isAddOn) {
      addOns.push(processed);
    } else {
      main.push(processed);
    }
  }

  if (apiVersion >= APIVersion.v1_1) {
    main = mergeCusProductResponses({
      cusProductResponses: main as CusProductResponse[],
    });
    addOns = mergeCusProductResponses({
      cusProductResponses: addOns as CusProductResponse[],
    });
  }

  return {
    main: main,
    addOns: addOns,
  };
};
