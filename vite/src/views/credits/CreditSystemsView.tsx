"use client";

import type { AppEnv } from "@autumn/shared";
import { useAxiosSWR } from "@/services/useAxiosSwr";
import { FeaturesContext } from "../features/FeaturesContext";
import LoadingScreen from "../general/LoadingScreen";
import CreateCreditSystem from "./CreateCreditSystem";
import { CreditSystemsTable } from "./CreditSystemsTable";

function CreditSystemsView({ env }: { env: AppEnv }) {
	const { data, isLoading, error, mutate } = useAxiosSWR({
		url: "/features",
		env: env,
	});

	if (isLoading) return <LoadingScreen />;

	return (
		<FeaturesContext.Provider
			value={{
				features: data?.features,
				env: env,
				mutate,
			}}
		>
			<div>
				<h1 className="text-xl font-medium">Credits</h1>
				<p className="text-sm text-t2">
					Define a credits system to bill for your users&apos; usage. These are
					made of other metered features.
				</p>
			</div>
			<CreditSystemsTable />
			<CreateCreditSystem />
		</FeaturesContext.Provider>
	);
}

export default CreditSystemsView;
