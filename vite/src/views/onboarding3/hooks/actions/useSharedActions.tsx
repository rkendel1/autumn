import type { ProductV2 } from "@autumn/shared";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useProductStore } from "@/hooks/stores/useProductStore";
import { useSheetStore } from "@/hooks/stores/useSheetStore";
import { useEnv } from "@/utils/envUtils";
import { OnboardingStep } from "../../utils/onboardingUtils";

interface SharedActionsProps {
	step: OnboardingStep;
	popStep: () => void;
	refetchProducts: () => Promise<void>;
	products: ProductV2[];
}

export const useSharedActions = ({
	step,
	popStep,
	refetchProducts,
	products,
}: SharedActionsProps) => {
	const navigate = useNavigate();
	const env = useEnv();

	// Get product from product store (working copy)
	const product = useProductStore((s) => s.product);
	const setProduct = useProductStore((s) => s.setProduct);
	const baseProduct = useProductStore((s) => s.baseProduct);
	const setBaseProduct = useProductStore((s) => s.setBaseProduct);

	const setSheet = useSheetStore((state) => state.setSheet);

	// Handle plan selection from dropdown
	const handlePlanSelect = useCallback(
		async (planId: string) => {
			if (!planId || planId === product.id) return;

			// Find the product in the already-fetched products list
			const selectedProduct = products.find((p) => p.id === planId);

			if (!selectedProduct) {
				console.error("Product not found in products list:", planId);
				return;
			}

			// Set as base product and working product
			setBaseProduct(selectedProduct);
			setProduct(selectedProduct);

			// Keep the edit-plan sheet open
			setSheet({ type: "edit-plan" });
		},
		[product.id, products, setBaseProduct, setProduct, setSheet],
	);

	// Handle back navigation
	const handleBack = useCallback(async () => {
		const { closeSheet } = useSheetStore.getState();
		closeSheet();

		// If we're on Step 3 (FeatureConfiguration), reset product to baseProduct
		// This removes the half-configured feature item that was added in Step 2
		if (step === OnboardingStep.FeatureConfiguration && baseProduct) {
			setProduct(baseProduct);
		}

		// handleBackNavigation logic is mostly commented out in utils
		// Just pop the step
		popStep();
	}, [popStep, step, baseProduct, setProduct]);

	// Handle create plan success from dialog
	const onCreatePlanSuccess = useCallback(
		async (newProduct: ProductV2) => {
			try {
				// Refetch products to update the list
				// useOnboardingProductSync will sync baseProduct with the backend version
				await refetchProducts();

				// Set the newly created product as base and working product
				setBaseProduct(newProduct);
				setProduct(newProduct);

				// Open edit-plan sheet
				setSheet({ type: "edit-plan" });
			} catch (error) {
				console.error("Failed to load new plan:", error);
				const { navigateTo } = await import("@/utils/genUtils");
				navigateTo(`/products/${newProduct.id}`, navigate, env);
			}
		},
		[setBaseProduct, setProduct, refetchProducts, setSheet, navigate, env],
	);

	// Handle delete plan success from dialog
	const handleDeletePlanSuccess = useCallback(async () => {
		// Refetch products - useOnboardingProductSync will automatically:
		// - Redirect to step 1 if no products left
		// - Fallback to products[0] if current product was deleted but others exist
		// - Sync both baseProduct and product
		await refetchProducts();
	}, [refetchProducts]);

	return useMemo(
		() => ({
			handlePlanSelect,
			handleBack,
			onCreatePlanSuccess,
			handleDeletePlanSuccess,
		}),
		[
			handlePlanSelect,
			handleBack,
			onCreatePlanSuccess,
			handleDeletePlanSuccess,
		],
	);
};
