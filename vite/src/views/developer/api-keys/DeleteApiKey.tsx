import type { ApiKey } from "@autumn/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DevService } from "@/services/DevService";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useEnv } from "@/utils/envUtils";
import { useDevContext } from "../DevContext";
export const DeleteApiKey = ({
	apiKey,
	setOpen,
}: {
	apiKey: ApiKey;
	setOpen: (open: boolean) => void;
}) => {
	const { mutate } = useDevContext();
	const env = useEnv();
	const axiosInstance = useAxiosInstance({ env });
	const [confirmText, setConfirmText] = useState("");

	const [deleteLoading, setDeleteLoading] = useState(false);

	const handleDelete = async () => {
		if (confirmText !== apiKey.name) {
			toast.error("Please type the correct API key name to confirm deletion");
			return;
		}

		setDeleteLoading(true);
		try {
			await DevService.deleteAPIKey(axiosInstance, apiKey.id);
			setOpen(false);
			mutate();
		} catch (_error) {
			toast.error("Failed to delete API key");
		}
		setDeleteLoading(false);
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Delete API Key</DialogTitle>
				<DialogDescription className="text-t3">
					To confirm the deletion of this API key, type{" "}
					<span className="font-bold">{apiKey.name}</span> below
				</DialogDescription>
			</DialogHeader>
			<Input
				type="text"
				placeholder={`Type "${apiKey.name}" to confirm`}
				className="w-full "
				value={confirmText}
				onChange={(e) => setConfirmText(e.target.value)}
				variant="destructive"
			/>
			<DialogFooter>
				<Button
					onClick={handleDelete}
					isLoading={deleteLoading}
					variant="destructive"
				>
					{deleteLoading ? "Deleting..." : "Delete"}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
};
