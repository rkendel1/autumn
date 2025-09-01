import { Pencil } from "lucide-react";
import { useState } from "react";
import FieldLabel from "@/components/general/modal-components/FieldLabel";
import { Input } from "@/components/ui/input";
import { slugify } from "@/utils/formatUtils/formatTextUtils";

export const ProductConfig = ({
	product,
	setProduct,
	isUpdate = false,
}: {
	product: any;
	setProduct: (product: any) => void;
	isUpdate?: boolean;
}) => {
	const [idEdit, setIdEdit] = useState(false);

	return (
		<div className="flex w-full gap-2">
			<div className="w-full">
				<FieldLabel>Name</FieldLabel>
				<Input
					placeholder="eg. Starter Product"
					value={product.name}
					onChange={(e) => {
						const newFields = { ...product, name: e.target.value };
						if (!idEdit && !isUpdate) {
							newFields.id = slugify(e.target.value);
						}
						setProduct(newFields);
					}}
				/>
			</div>
			<div className="w-full">
				<FieldLabel>ID</FieldLabel>
				<div className="flex items-center gap-2">
					<Input
						autoFocus={idEdit}
						placeholder="eg. Product ID"
						disabled={!idEdit}
						className="disabled:bg-transparent disabled:border-none disabled:shadow-none"
						value={product.id}
						onChange={(e) => {
							setProduct({ ...product, id: e.target.value });
						}}
					/>
					<Pencil
						size={12}
						className="text-t3 cursor-pointer w-8 h-8 px-2 "
						onClick={() => setIdEdit(true)}
					/>
				</div>
			</div>
		</div>
	);
};
