import { useDevQuery } from "@/hooks/queries/useDevQuery";
import { APIKeyTable } from "./components/APIKeyTable";
import CreateAPIKey from "./components/CreateAPIKey";

export const ApiKeysView = () => {
  const { apiKeys } = useDevQuery();
  return (
    <div>
      <div className="sticky top-0 z-10 border-y bg-stone-100 pl-10 pr-7 h-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-sm text-t2 font-medium">Secret API Keys</h2>
          <span className="text-t2 px-1 rounded-md bg-stone-200">
            {apiKeys.length}
          </span>
        </div>
        <CreateAPIKey />
      </div>

      {apiKeys.length > 0 ? (
        <APIKeyTable apiKeys={apiKeys} />
      ) : (
        <div
          className="flex flex-col px-10 center text-t3 text-sm w-full
        min-h-[60vh] gap-4 mt-3"
        >
          <p className="text-sm text-t3">
            API keys are used to securely authenticate your requests from your
            server. Learn more{" "}
            <a
              className="text-primary hover:text-primary/80 cursor-pointer"
              href="https://docs.useautumn.com"
              target="_blank"
            >
              here
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
};
