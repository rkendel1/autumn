import { AppEnv } from "@autumn/shared";
import { AutumnProvider } from "autumn-js/react";
import { ArrowUpRightFromSquare } from "lucide-react";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { CustomToaster } from "@/components/general/CustomToaster";
import { Button } from "@/components/ui/button";
import { useGlobalErrorHandler } from "@/hooks/useGlobalErrorHandler";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useEnv } from "@/utils/envUtils";
import { navigateTo } from "@/utils/genUtils";
import LoadingScreen from "@/views/general/LoadingScreen";
import { MainSidebar } from "@/views/main-sidebar/MainSidebar";
import {
	SidebarContext,
	useSidebarContext,
} from "@/views/main-sidebar/SidebarContext";
import { AppContext } from "./AppContext";

export function MainLayout() {
	const env = useEnv();
	const { data, isPending } = useSession();
	const [sidebarState, setSidebarState] = useState<"expanded" | "collapsed">(
		"expanded",
	);
	const { handleApiError } = useGlobalErrorHandler();

	const navigate = useNavigate();
	const posthog = usePostHog();

	// Global error handler for API errors
	useEffect(() => {
		const handleGlobalError = (event: ErrorEvent) => {
			if (event.error?.response) {
				handleApiError(event.error);
			}
		};

		window.addEventListener("error", handleGlobalError);
		return () => window.removeEventListener("error", handleGlobalError);
	}, [handleApiError]);

	useEffect(() => {
		// Identify user
		if (data && process.env.NODE_ENV !== "development") {
			const email = data.user.email;

			posthog?.identify(email, {
				email,
				name: data.user.name,
				id: data.user.id,
			});
		}
	}, [data, posthog]);

	// 1. If not loaded, show loading screen
	if (isPending) {
		return (
			<SidebarContext.Provider
				value={{ state: sidebarState, setState: setSidebarState }}
			>
				<div className="w-screen h-screen flex bg-stone-100">
					<MainSidebar />
					<div className="w-full h-screen flex flex-col overflow-hidden py-3 pr-3">
						<div className="w-full h-full flex flex-col overflow-hidden rounded-lg border">
							{env === AppEnv.Sandbox && (
								<div className="w-full min-h-10 h-10 bg-amber-100 text-white text-sm flex items-center justify-center relative px-4">
									<p className="font-medium text-amber-500 font-mono">
										You&apos;re in sandbox
									</p>
									<Button
										variant="default"
										className="h-6 border border-amber-500 bg-transparent text-amber-500 hover:bg-amber-500 hover:text-white font-mono rounded-xs ml-auto absolute right-4"
										onClick={() => {
											navigateTo("/onboarding", navigate, AppEnv.Sandbox);
										}}
									>
										Onboarding
										<ArrowUpRightFromSquare size={12} className="inline ml-1" />
									</Button>
								</div>
							)}
							<div className="flex bg-stone-50 flex-col h-full">
								<LoadingScreen />
							</div>
						</div>
					</div>
				</div>
			</SidebarContext.Provider>
		);
	}

	// 2. If no user, redirect to sign in
	if (!data) {
		navigate("/sign-in");
		return;
	}

	// if (!pathname.includes("/onboarding")) {
	//   return (
	//     <Navigate
	//       to={getRedirectUrl("/onboarding", AppEnv.Sandbox)}
	//       replace={true}
	//     />
	//   );
	// }

	return (
		<AutumnProvider
			backendUrl={import.meta.env.VITE_BACKEND_URL}
			includeCredentials={true}
		>
			<SidebarContext.Provider
				value={{ state: sidebarState, setState: setSidebarState }}
			>
				<NuqsAdapter>
					<main className="w-screen h-screen flex bg-stone-100">
						<CustomToaster />
						<MainSidebar />
						<MainContent />
					</main>
				</NuqsAdapter>
			</SidebarContext.Provider>
		</AutumnProvider>
	);
}

const MainContent = () => {
	const env = useEnv();
	const navigate = useNavigate();
	const { state, setState } = useSidebarContext();

	return (
		<AppContext.Provider value={{}}>
			<div className="w-full h-screen flex flex-col justify-center overflow-hidden py-3 pr-3 relative">
				<div className="w-full h-full flex flex-col overflow-hidden rounded-lg border">
					{/* Toggle Button */}

					{env === AppEnv.Sandbox && (
						<div className="w-full min-h-10 h-10 bg-amber-100 text-sm flex items-center justify-center relative px-4 text-amber-500 ">
							<p className="font-medium font-mono">You&apos;re in sandbox</p>
							{!window.location.pathname.includes("/onboarding") && (
								<Button
									variant="default"
									className="h-6 border border-amber-500 bg-transparent text-amber-500 hover:bg-amber-500 hover:text-white font-mono rounded-xs ml-auto absolute right-4"
									onClick={() => {
										navigateTo("/onboarding", navigate, AppEnv.Sandbox);
									}}
								>
									Onboarding
									<ArrowUpRightFromSquare size={12} className="inline ml-1" />
								</Button>
							)}
						</div>
					)}
					<div
						className={cn(
							"w-full h-full overflow-auto flex justify-center bg-stone-50",
						)}
					>
						<div className="hidden md:flex w-full h-full justify-center">
							<Outlet />
						</div>
						<div className="md:hidden w-full h-full flex items-center justify-center">
							<div className="bg-white p-6 rounded-lg shadow-sm text-center">
								<h2 className="text-xl font-semibold mb-2">
									Autumn is coming to mobile soon
								</h2>
								<p className="text-gray-600">
									We&apos;re currently designed for larger screens. Come back on
									your desktop?
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AppContext.Provider>
	);
};
