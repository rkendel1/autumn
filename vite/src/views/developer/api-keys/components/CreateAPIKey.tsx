import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import React, { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { DevService } from "@/services/DevService";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useDevQuery } from "@/hooks/queries/useDevQuery";

const CreateAPIKey = () => {
  const { refetch } = useDevQuery();
  const axiosInstance = useAxiosInstance();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setName("");
    setApiKey("");
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (copied) {
      setTimeout(() => setCopied(false), 1000);
    }
  }, [copied]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { api_key } = await DevService.createAPIKey(axiosInstance, {
        name: name,
      });

      setApiKey(api_key);
      await refetch();
    } catch (error) {
      console.log("Error:", error);
      toast.error("Failed to create API key");
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-fit" variant="add" disabled={false}>
          Secret Key
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-lg min-w-md">
        <DialogHeader>
          <DialogTitle>Create Secret API Key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-y-4">
          {apiKey ? (
            <>
              <p className="text-sm text-t3 font-medium">
                Please copy your API Key and keep it somewhere safe. You
                won&apos;t be able to view it anymore after this
              </p>
              <div className="flex justify-between bg-zinc-100 p-2 px-3 text-t2 rounded-md items-center">
                <p className="text-sm">{apiKey}</p>
                <button
                  className="text-t2 hover:text-t2/80"
                  onClick={() => {
                    setCopied(true);
                    navigator.clipboard.writeText(apiKey);
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2 text-sm text-t3">Name</p>
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          {apiKey ? (
            <Button onClick={() => setOpen(false)}>Close</Button>
          ) : (
            <Button
              isLoading={loading}
              onClick={handleCreate}
              variant="gradientPrimary"
            >
              Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAPIKey;
