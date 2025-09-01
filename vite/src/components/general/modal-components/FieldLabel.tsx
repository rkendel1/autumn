import { cn } from "@/lib/utils";

function FieldLabel({ children, className, description, empty = false }: any) {
	if (empty) {
		children = "\u00A0";
	}
	if (!description) {
		return (
			<div className={cn("text-t3 text-sm mb-2", className)}>{children}</div>
		);
	}
	return (
		<div className={cn("text-t3 text-sm mb-2", className)}>
			{children}
			{description && <p className="text-t3 text-xs">{description}</p>}
		</div>
	);
}

export default FieldLabel;
