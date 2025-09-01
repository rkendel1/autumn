import type { Product } from "@autumn/shared";
import { Delete, EllipsisVertical } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import SmallSpinner from "@/components/general/SmallSpinner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useProductContext } from "../ProductContext";

export const EditFreeTrialToolbar = ({
	className,
	product,
}: {
	className?: string;
	product: Product;
}) => {
	const { mutate, env, setProduct, product: curProduct } = useProductContext();
	const _axiosInstance = useAxiosInstance(env);

	const [deleteLoading, _setDeleteLoading] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const _navigate = useNavigate();

	const handleDelete = async () => {
		setProduct({ ...product, free_trial: null });
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
					<EllipsisVertical size={12} className="text-t3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="text-t2">
				<DropdownMenuItem
					className="flex items-center bg-red-500 text-white"
					onClick={async (e) => {
						e.stopPropagation();
						e.preventDefault();
						await handleDelete();
					}}
				>
					<div className="flex items-center justify-between w-full gap-2">
						Delete
						{deleteLoading ? (
							<SmallSpinner />
						) : (
							<Delete size={12} className="text-t3" />
						)}
					</div>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
