import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModelPricingContext } from "./ModelPricingContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, Trash } from "lucide-react";
import { DeleteProductDialog } from "@/views/products/components/DeleteProductDialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const SelectEditProduct = () => {
  const {
    data,
    productDataState: { product, setProduct },
    queryStates,
    setQueryStates,
  } = useModelPricingContext();
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);

  const selectedClassName = "!bg-zinc-100 h-7 border";
  if (data.products.length > 3) {
    return (
      <>
        <DeleteProductDialog
          product={product}
          open={deleteProductOpen}
          setOpen={setDeleteProductOpen}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-fit text-t3 bg-zinc-100 h-7 rounded-md border min-w-24 mr-2"
            >
              <p className="text-t3">{product?.name || "None"}</p>
              <ChevronDownIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[600px]">
            {data.products.map((p: any) => {
              if (!p.name) {
                return null;
              }
              return (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => {
                    setProduct(p);
                    setQueryStates({
                      productId: p.id,
                    });
                  }}
                  className="flex items-center justify-between group"
                >
                  {p.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 rounded-md hover:bg-red-100 hover:text-red-400 hover:border-red-400 text-t3 ml-2 invisible group-hover:visible duration-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDeleteProductOpen(true);
                    }}
                  >
                    <Trash size={12} />
                  </Button>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  const tabTriggerClass =
    "data-[state=active]:bg-stone-200 data-[state=active]:text-t2 data-[state=active]:font-medium";

  return (
    <>
      <DeleteProductDialog
        product={product}
        open={deleteProductOpen}
        setOpen={setDeleteProductOpen}
      ></DeleteProductDialog>
      <Tabs className="" value={product.id}>
        <TabsList className="gap-1 mr-1">
          {data.products.map((p: any) => {
            if (!p.name) {
              return null;
            }

            const isSelected = p.id === product.id;
            return (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className={cn(tabTriggerClass, isSelected && selectedClassName)}
                onClick={() => {
                  setProduct(p);
                  setQueryStates({
                    productId: p.id,
                  });
                }}
              >
                {p.name}
                {isSelected && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 rounded-md hover:bg-red-100 hover:text-red-400  text-t3 ml-2"
                    onClick={() => {
                      setDeleteProductOpen(true);
                    }}
                  >
                    <Trash size={14} />
                  </Button>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </>
  );
};
