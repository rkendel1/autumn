import Step from "@/components/general/OnboardingStep";
import CodeBlock from "../components/CodeBlock";

const react = () => {
	return `import { AutumnProvider } from "autumn-js/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  return (
    <html>
      <body>
        <AutumnProvider backendUrl="http://localhost:8000">
          {children}
        </AutumnProvider>
      </body>
    </html>
  );
}
`;
};

export default function AutumnProviderStep({ number }: { number: number }) {
	return (
		<Step
			title="Set up <AutumnProvider />"
			number={number}
			description={
				<p>
					Wrap your root layout with the AutumnProvider component, and pass in
					your backend URL.
				</p>
			}
		>
			{/* <div className="flex gap-8 w-full justify-between flex-col lg:flex-row"> */}
			{/* <p>
            You can do this directly from your frontend using the Publishable
            API Key.
          </p> */}

			{/* <div className="w-full lg:w-2/3 min-w-md max-w-2xl"> */}
			<CodeBlock
				snippets={[
					{
						title: "React",
						language: "javascript",
						displayLanguage: "javascript",
						content: react(),
					},
				]}
			/>
			{/* </div> */}
			{/* </div> */}
		</Step>
	);
}
