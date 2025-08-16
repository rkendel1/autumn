import { ProductService } from "@/services/products/ProductService";
import { getBackendErr } from "@/utils/genUtils";
import { Product, ProductV2, UpdateProductSchema } from "@autumn/shared";
import { AxiosInstance } from "axios";
import { toast } from "sonner";
import { isFreeProduct } from "@/utils/product/priceUtils";

export const updateProduct = async ({
  axiosInstance,
  product,
  mutate,
  mutateCount,
}: {
  axiosInstance: AxiosInstance;
  product: ProductV2;
  mutate: () => void;
  mutateCount: () => void;
}) => {
  try {
    await ProductService.updateProduct(axiosInstance, product.id, {
      ...UpdateProductSchema.parse(product),
      items: product.items,
      free_trial: product.free_trial,
    });

    toast.success("Product updated successfully");

    await mutate();
    await mutateCount();
  } catch (error) {
    toast.error(getBackendErr(error, "Failed to update product"));
  }
};
