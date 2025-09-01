import type { ProductV2 } from "@autumn/shared";
import { Delete, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import SmallSpinner from "@/components/general/SmallSpinner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProductService } from "@/services/products/ProductService";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { getBackendErr, navigateTo } from "@/utils/genUtils";
import { useProductContext } from "./ProductContext";

export const EditProductToolbar = ({
	className,
	product,
}: {
	className?: string;
	product: ProductV2;
}) => {
	const { mutate, env, numVersions, version } = useProductContext();
	const axiosInstance = useAxiosInstance({ env });

	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const navigate = useNavigate();

	const handleDelete = async () => {
		try {
			if (version && version < numVersions) {
				toast.error("Can't delete earlier version of a product");
				return;
			}

			setDeleteLoading(true);
			await ProductService.deleteProduct(axiosInstance, product.id);

			if (numVersions > 1) {
				navigateTo(
					`/products/${product.id}?version=${numVersions - 1}`,
					navigate,
					env,
				);
				toast.success(
					`${product.name} (version ${numVersions}) deleted successfully`,
				);
			} else {
				navigateTo(`/products`, navigate, env);
				toast.success(`${product.name} deleted successfully`);
			}
		} catch (error) {
			toast.error(getBackendErr(error, "Failed to delete product"));
		} finally {
			setDeleteLoading(false);
		}
	};
	return (
		<DropdownMenu open={deleteOpen} onOpenChange={setDeleteOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					isIcon
					variant="ghost"
					dim={6}
					className={cn("rounded-full", className)}
				>
					<Settings size={14} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="text-t2" align="end">
				<DropdownMenuItem
					// className="flex items-center bg-red-500 text-white"
					className="flex items-center text-red-500 hover:!bg-red-500 hover:!text-white text-xs"
					onClick={async (e) => {
						e.stopPropagation();
						e.preventDefault();
						await handleDelete();
					}}
				>
					<div className="flex items-center justify-between w-full gap-2">
						{numVersions > 1 ? "Delete version" : "Delete"}
						{deleteLoading ? <SmallSpinner /> : <Delete size={12} />}
					</div>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
