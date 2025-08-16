import { getStripeCusData } from "@/internal/customers/attach/attachUtils/attachParams/attachParamsUtils/getStripeCusData.js";
import { AttachParams } from "@/internal/customers/cusProducts/AttachParams.js";
import { ExtendedRequest } from "@/utils/models/Request.js";
import {
  APIVersion,
  FullCusProduct,
  FullCustomer,
  FullProduct,
} from "@autumn/shared";
import Stripe from "stripe";

export const migrationToAttachParams = async ({
  req,
  stripeCli,
  customer,
  cusProduct,
  newProduct,
}: {
  req: ExtendedRequest;
  stripeCli: Stripe;
  customer: FullCustomer;
  cusProduct: FullCusProduct;
  newProduct: FullProduct;
}): Promise<AttachParams> => {
  const { org } = req;

  const apiVersion = org.config.api_version || APIVersion.v1;
  const internalEntityId = cusProduct.internal_entity_id || undefined;

  const { stripeCus, paymentMethod, now } = await getStripeCusData({
    stripeCli,
    db: req.db,
    org: req.org,
    env: req.env,
    customer,
    logger: req.logtail,
    allowNoStripe: true,
  });

  const attachParams: AttachParams = {
    stripeCli,
    stripeCus,
    now,
    paymentMethod,

    customer,
    products: [newProduct],
    optionsList: cusProduct.options,
    prices: newProduct.prices,
    entitlements: newProduct.entitlements,
    freeTrial: newProduct.free_trial || null,
    replaceables: [],

    req,
    org: req.org,
    entities: customer.entities,
    features: req.features,
    internalEntityId,
    cusProducts: customer.customer_products,

    // Others
    apiVersion,
  };

  return attachParams;
};
