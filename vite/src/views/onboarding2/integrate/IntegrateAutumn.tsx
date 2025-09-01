import { AutumnProvider } from "autumn-js/react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AITools } from "./AITools";
import { ConnectStripeStep } from "./ConnectStripeStep";
import { IntegrateContext } from "./IntegrateContext";
import { AddAutumnProvider } from "./integration-steps/AddAutumnProvider";
import { AutumnHandler } from "./integration-steps/AutumnHandler";
import { CheckoutPricingTable } from "./integration-steps/CheckoutPricingTable";
import { EnvStep } from "./integration-steps/EnvStep";
import { Install } from "./integration-steps/Install";
import { NextSteps } from "./NextSteps";
import { SelectStack } from "./SelectStack";

export default function IntegrateAutumn({
	data,
	mutate,
	queryStates,
	setQueryStates,
}: {
	data: any;
	mutate: any;
	queryStates: any;
	setQueryStates: any;
}) {
	const stackSelected =
		queryStates.frontend && queryStates.backend && queryStates.auth;

	return (
		<IntegrateContext.Provider
			value={{ queryStates, setQueryStates, data, mutate }}
		>
			<div className="w-full h-full p-10 flex flex-col items-center justify-start overflow-y-scroll">
				<div className="max-w-[600px] w-full flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<Button
							variant="dialogBack"
							className="w-fit pl-0 ml-0 flex items-center gap-2 !px-1"
							onClick={() => {
								setQueryStates({
									page: "pricing",
								});
							}}
						>
							<ArrowLeftIcon size={14} />
							Create your pricing plans
						</Button>
						<p className="text-xl">Integrate Autumn</p>
						<p className="text-t3">
							Let's integrate Autumn and get your first customer onto one of
							your plans
						</p>
					</div>

					<AITools />
					<div className="flex flex-col gap-8 pb-40">
						<SelectStack />
						{stackSelected && queryStates.reactTypescript && (
							<>
								<ConnectStripeStep mutate={mutate} productData={data} />
								<EnvStep />
								<Install />
								<AutumnHandler />
								<AddAutumnProvider />
								<CheckoutPricingTable />
								<AutumnProvider
									backendUrl={`${import.meta.env.VITE_BACKEND_URL}/demo`}
									includeCredentials={true}
								>
									<NextSteps />
								</AutumnProvider>
							</>
						)}
					</div>
				</div>
			</div>
		</IntegrateContext.Provider>
	);
}
