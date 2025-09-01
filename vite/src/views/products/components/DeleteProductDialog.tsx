import type { Product, ProductCounts } from "@autumn/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ProductService } from "@/services/products/ProductService";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useAxiosSWR } from "@/services/useAxiosSwr";
import { useEnv } from "@/utils/envUtils";
import { getBackendErr } from "@/utils/genUtils";
import { useProductsContext } from "../ProductsContext";

export const DeleteProductDialog = ({
	product,
	open,
	setOpen,
	productCounts,
}: {
	product: Product;
	open: boolean;
	setOpen: (open: boolean) => void;
	productCounts?: ProductCounts;
}) => {
	const { mutate } = useProductsContext();
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [archiveLoading, setArchiveLoading] = useState(false);
	const axiosInstance = useAxiosInstance();
	const _env = useEnv();

	const { data: productInfo, isLoading } = useAxiosSWR({
		url: `/products/${product.id}/info`,
		options: {
			refreshInterval: 0,
		},
	});

	// const {
	//   data: deletionText,
	//   isLoading: isDeletionTextLoading,
	//   mutate: mutateDeletionText,
	// } = useAxiosSWR({
	//   url: `/products/data/deletion_text/${product.id}`,
	//   options: {
	//     refreshInterval: 0,
	//   },
	// });

	// useEffect(() => {
	//   if (open) {
	//     mutateDeletionText();
	//   }
	// }, [open, product.internal_id]);

	const [deleteAllVersions, setDeleteAllVersions] = useState(false);

	const handleDelete = async () => {
		setDeleteLoading(true);
		try {
			await ProductService.deleteProduct(
				axiosInstance,
				product.id,
				deleteAllVersions,
			);
			await mutate();
			setOpen(false);
		} catch (error) {
			console.error("Error deleting product:", error);
			toast.error(getBackendErr(error, "Error deleting product"));
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleArchive = async () => {
		setArchiveLoading(true);
		const newArchivedState = !product.archived;
		try {
			if (!deleteAllVersions) {
				if (newArchivedState === true)
					await ProductService.updateProduct(axiosInstance, product.id, {
						archived: newArchivedState,
					});
				else {
					const updatePromises = [];
					for (let i = 1; i <= productInfo.numVersion; i++) {
						updatePromises.push(
							ProductService.updateProduct(
								axiosInstance,
								product.id,
								{
									archived: newArchivedState,
									version: i,
								},
								i,
							),
						);
					}
					await Promise.all(updatePromises);
				}
			} else {
				const updatePromises = [];
				for (let i = 1; i <= productInfo.numVersion; i++) {
					updatePromises.push(
						ProductService.updateProduct(
							axiosInstance,
							product.id,
							{
								archived: newArchivedState,
								version: i,
							},
							i,
						),
					);
				}
				await Promise.all(updatePromises);
			}
			await mutate();
			toast.success(
				`Product ${product.name} ${newArchivedState ? "archived" : "unarchived"} successfully`,
			);
			setOpen(false);
		} catch (error) {
			toast.error(
				getBackendErr(
					error,
					`Error ${newArchivedState ? "archiving" : "unarchiving"} product`,
				),
			);
		} finally {
			setArchiveLoading(false);
		}
	};

	const hasCusProductsAll = productInfo?.hasCusProducts;
	const hasCusProductsLatest = productInfo?.hasCusProductsLatest;

	const hasCusProducts = deleteAllVersions
		? hasCusProductsAll
		: hasCusProductsLatest;

	const getDeleteMessage = () => {
		if (product.archived) {
			return `This product is currently archived and hidden from the UI. Would you like to unarchive it to make it visible again?\n
			Note: If there are multiple versions, this will unarchive all versions at once.`;
		}

		const isMultipleVersions = productInfo?.numVersion > 1;
		const versionText = deleteAllVersions ? "product" : "version";
		const productText = isMultipleVersions ? versionText : "product";
		// Deleting this ${productText} will remove it from their accounts. Are you sure you want to continue? You can also archive the product instead.
		const messageTemplates = {
			withCustomers: {
				single: (customerName: string, productText: string) =>
					`${customerName} is on this ${productText}. Are you sure you want to archive it?`,
				multiple: (
					customerName: string,
					otherCount: number,
					productText: string,
				) =>
					`${customerName} and ${otherCount} other customer${otherCount > 1 ? "s" : ""} are on this ${productText}. Are you sure you want to archive this product? 
          
          `,
				fallback: (productText: string) =>
					`There are customers on this ${productText}. Deleting this ${productText} will remove it from their accounts. Are you sure you want to continue? You can also archive the product instead.`,
			},
			withoutCustomers: (productText: string) =>
				`Are you sure you want to delete this ${productText}? This action cannot be undone.`,
			// live: {
			//   withCustomers: {
			//     single: (customerName: string, productText: string) =>
			//       `${customerName} is on this ${productText}. Please delete them first before deleting the ${productText}. Would you like to archive the product instead?`,
			//     multiple: (
			//       customerName: string,
			//       otherCount: number,
			//       productText: string
			//     ) =>
			//       `${customerName} and ${otherCount} other customer${otherCount > 1 ? "s" : ""} are on this ${productText}. Please delete them first before deleting the ${productText}. Would you like to archive the product instead?`,
			//     fallback: (productText: string) =>
			//       `There are customers on this ${productText}. Please delete them first before deleting the ${productText}. Would you like to archive the product instead?`,
			//   },
			//   withoutCustomers: (productText: string) =>
			//     `Are you sure you want to delete this ${productText}? This action cannot be undone. You can also archive the ${productText} instead.`,
			// },
			// sandbox: {
			//   withCustomers: {
			//     single: (customerName: string, productText: string) =>
			//       `${customerName} is on this ${productText}. Deleting this ${productText} will remove it from ${customerName}'s account. Are you sure you want to continue? You can also archive the product instead.`,
			//     multiple: (
			//       customerName: string,
			//       otherCount: number,
			//       productText: string
			//     ) =>
			//       `${customerName} and ${otherCount} other customer${otherCount > 1 ? "s" : ""} are on this ${productText}. Deleting this ${productText} will remove it from their accounts. Are you sure you want to continue? You can also archive the product instead.`,
			//     fallback: (productText: string) =>
			//       `There are customers on this ${productText}. Deleting this ${productText} will remove it from their accounts. Are you sure you want to continue? You can also archive the product instead.`,
			//   },
			//   withoutCustomers: (productText: string) =>
			//     `Are you sure you want to delete this ${productText}? This action cannot be undone.`,
			// },
		};

		const templates = messageTemplates;

		if (hasCusProducts) {
			if (productInfo?.customerName && productInfo?.totalCount) {
				const totalCount = parseInt(productInfo.totalCount, 10);

				if (Number.isNaN(totalCount) || totalCount <= 0) {
					return templates.withCustomers.fallback(productText);
				} else if (totalCount === 1) {
					return templates.withCustomers.single(
						productInfo.customerName,
						productText,
					);
				} else {
					const otherCount = totalCount - 1;
					return templates.withCustomers.multiple(
						productInfo.customerName,
						otherCount,
						productText,
					);
				}
			} else {
				return templates.withCustomers.fallback(productText);
			}
			return "";
		} else {
			return templates.withoutCustomers(productText);
		}
	};

	if (!productInfo) {
		return <></>;
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="w-md" onClick={(e) => e.stopPropagation()}>
				<DialogHeader>
					<DialogTitle>
						{product.archived ? "Unarchive" : "Delete"} {product.name}
					</DialogTitle>
				</DialogHeader>

				{productInfo.numVersion > 1 && !product.archived && (
					<Select
						value={deleteAllVersions ? "all" : "latest"}
						onValueChange={(value) => setDeleteAllVersions(value === "all")}
					>
						<SelectTrigger className="w-6/12">
							<SelectValue placeholder="Select a version" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest">Delete latest version</SelectItem>
							<SelectItem value="all">Archive product</SelectItem>
						</SelectContent>
					</Select>
				)}

				<div className="flex text-t2 text-sm">
					<p>
						{getDeleteMessage()
							.split("\n")
							.map((line, index) => (
								<span key={index}>
									{line}
									{index < getDeleteMessage().split("\n").length - 1 && <br />}
								</span>
							))}
					</p>
				</div>
				<DialogFooter>
					{product.archived && (
						<Button
							variant="outline"
							onClick={handleArchive}
							isLoading={archiveLoading}
						>
							Unarchive
						</Button>
					)}
					{hasCusProducts && !product.archived && (
						<Button
							variant="outline"
							onClick={handleArchive}
							isLoading={archiveLoading}
						>
							Archive
						</Button>
					)}

					{!hasCusProducts && !product.archived && (
						<Button
							variant="destructive"
							onClick={handleDelete}
							isLoading={deleteLoading}
						>
							Delete
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
