import { formatUnixToDate } from "@/utils/formatUtils/formatDateUtils";
import { notNullish } from "@/utils/genUtils";
import { useProductContext } from "@/views/products/product/ProductContext";
import {
  AttachBranch,
  FeatureType,
  FeatureUsageType,
  ProductItem,
  ProductItemFeatureType,
} from "@autumn/shared";
import { format } from "date-fns";
import { InfoIcon, CheckCircle } from "lucide-react";

export const AttachInfo = () => {
  const { attachState, product } = useProductContext();
  const { preview, flags } = attachState;

  const currentProduct = preview?.current_product;
  const scheduledProduct = preview?.scheduled_product;

  const getAttachDescription = () => {
    if (preview?.branch == AttachBranch.Downgrade) {
      let text = `The customer is currently on ${currentProduct.name} and will downgrade to ${product.name} on ${formatUnixToDate(preview.due_next_cycle?.due_at)}`;
      if (scheduledProduct) {
        text += `. The scheduled product ${scheduledProduct.product.name} will also be removed.`;
      }
      return text;
    }

    if (preview?.free_trial) {
      let text = `The free trial for ${product.name} will end on ${formatUnixToDate(preview.due_next_cycle?.due_at)}`;
      if (currentProduct && currentProduct.free_trial) {
        text += ` and the customer's current trial to ${currentProduct.name} will be canceled.`;
      } else {
        text += `.`;
      }
      return text;
    }

    if (preview?.branch == AttachBranch.NewVersion) {
      const usagePriceExists = product.items.some((item: ProductItem) => {
        const priceExists = notNullish(item.tiers) || notNullish(item.price);
        return (
          item.feature_type === ProductItemFeatureType.SingleUse && priceExists
        );
      });

      let text = `You are switching this customer to version ${product.version} of ${product.name}.`;
      if (preview.due_next_cycle?.due_at) {
        text += `Their features will update immediately and from ${formatUnixToDate(preview.due_next_cycle?.due_at)} onwards, they will pay any new prices${usagePriceExists ? " (including usage from the last cycle)" : ""}.`;
      }

      return (
        <>
          <span>
            {/* You are switching this customer to version {product.version} of{" "}
            {product.name}. */}
            {text}
          </span>
        </>
      );

      // let text = `The customer is currently on ${currentProduct.name} v${currentProduct.version}. Switching to v${product.version} will update the customer's features immediately, and from ${formatUnixToDate(preview.due_next_cycle.due_at)} onwards they will pay any new prices`;

      // if (usagePriceExists) {
      //   text += ` (including usage from the last cycle).`;
      // } else {
      //   text += `.`;
      // }

      return text;
    }

    switch (preview?.branch) {
      case AttachBranch.SameCustomEnts:
        return "No changes to prices or subscriptions will be made";

      case AttachBranch.Renew:
        if (scheduledProduct) {
          return `${scheduledProduct.product.name} is scheduled to start on ${formatUnixToDate(scheduledProduct.starts_at)}. Renewing ${currentProduct.name} will undo this.`;
        } else {
          return null;
        }
      default:
        return null;
    }
  };
  const description = getAttachDescription();

  const hasNoPriceChanges = () => {
    if (preview?.branch === AttachBranch.SameCustomEnts) {
      return true;
    }

    if (flags.isFree) {
      return true;
    }

    if (preview?.due_today?.total === 0) {
      return true;
    }

    return false;
  };

  if (!description) {
    return null;
  }

  // if (hasNoPriceChanges()) {
  //   return (
  //     <div className="flex items-center p-2 bg-green-50 border-1 border-green-200 text-green-700 rounded-xs">
  //       <div className="min-w-6 flex">
  //         <CheckCircle size={14} />
  //       </div>
  //       <p className="text-sm font-medium">No changes to prices or subscriptions will be made</p>
  //     </div>
  //   );
  // }

  return (
    <div className="flex items-center p-2 bg-blue-50 border-1 border-blue-200 text-blue-400 rounded-xs">
      <div className="min-w-6 flex">
        <InfoIcon size={14} />
      </div>
      <p className="text-sm">{getAttachDescription()}</p>
    </div>
  );
};
