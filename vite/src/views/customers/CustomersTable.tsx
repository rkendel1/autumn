import { formatUnixToDateTime } from "@/utils/formatUtils/formatDateUtils";
import {
  CusProductSchema,
  CusProductStatus,
  CustomerSchema,
  FullCusProduct,
  ProductSchema,
} from "@autumn/shared";

import { Link, useNavigate } from "react-router";

import { getRedirectUrl, navigateTo } from "@/utils/genUtils";
import { Badge } from "@/components/ui/badge";
import { unixHasPassed } from "@/utils/dateUtils";
import { z } from "zod";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEnv } from "@/utils/envUtils";
import { useCustomersContext } from "./CustomersContext";
import { Item, Row } from "@/components/general/TableGrid";
import React from "react";

import CopyButton from "@/components/general/CopyButton";
import { CustomerRowToolbar } from "./CustomerRowToolbar";

const CustomerWithProductsSchema = CustomerSchema.extend({
  customer_products: z.array(
    CusProductSchema.extend({ product: ProductSchema })
  ),
});
type CustomerWithProducts = z.infer<typeof CustomerWithProductsSchema>;

export const CustomersTable = ({
  customers,
}: {
  customers: CustomerWithProducts[];
}) => {
  const env = useEnv();
  const navigate = useNavigate();
  const { versionCounts } = useCustomersContext();

  // console.log("customers", customers);
  const getCusProductsInfo = (customer: CustomerWithProducts) => {
    if (
      !customer.customer_products ||
      customer.customer_products.length === 0
    ) {
      return <></>;
    }

    // Filter out expired products first
    const activeProducts = customer.customer_products.filter(
      (cusProduct) => cusProduct.status !== CusProductStatus.Expired
    );

    if (activeProducts.length === 0) {
      return <></>;
    }

    const getProductBadge = (cusProduct: FullCusProduct) => {
      const name = cusProduct.product.name;
      const status = cusProduct.status;

      const versionCount = versionCounts[cusProduct.product.id];
      const version = cusProduct.product.version;

      const prodName = (
        <>
          {name}
          {versionCount > 1 && (
            <>
              <Badge
                variant="outline"
                className="text-xs bg-stone-50 text-t3 px-2 ml-2 font-mono py-0"
              >
                v{version}
              </Badge>
            </>
          )}
        </>
      );

      if (status === CusProductStatus.PastDue) {
        return (
          <>
            <span>{prodName}</span>{" "}
            <Badge variant="status" className="bg-red-500">
              Past Due
            </Badge>
          </>
        );
      } else {
        if (cusProduct.canceled_at) {
          return (
            <>
              <span>{prodName}</span>{" "}
              <Badge variant="status" className="bg-yellow-500">
                Canceled
              </Badge>
            </>
          );
        } else if (
          cusProduct.trial_ends_at &&
          !unixHasPassed(cusProduct.trial_ends_at)
        ) {
          return (
            <>
              <span>{prodName}</span>{" "}
              <Badge variant="status" className="bg-lime-500">
                Trial
              </Badge>
            </>
          );
        } else {
          return (
            <>
              <span>{prodName}</span>
            </>
          );
        }
      }
    };

    return (
      <>
        <div className="flex flex-wrap gap-2">
          {activeProducts.slice(0, 1).map((cusProduct: any, index: number) => (
            <div key={index}>
              {getProductBadge(cusProduct)}
              {activeProducts.length > 1 && (
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger>
                      <Badge
                        variant="status"
                        className="ml-1 bg-stone-100 text-primary"
                      >
                        +{activeProducts.length - 1}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {activeProducts
                        .slice(1)
                        .map((p: any) => p.product.name)
                        .join(", ")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Row type="header" className="grid-cols-17 -mb-1">
        <Item className="col-span-3">Name</Item>
        <Item className="col-span-3">ID</Item>
        <Item className="col-span-3">Email</Item>
        <Item className="col-span-5">Products</Item>
        <Item className="col-span-2">Created At</Item>
      </Row>

      {customers.map((customer, index) => (
        <React.Fragment key={index}>
          <Link
            to={getRedirectUrl(
              `/customers/${customer.id || customer.internal_id}`,
              env
            )}
            key={index}
            className="grid grid-cols-17 gap-2 items-center px-10 w-full text-sm h-8 cursor-default hover:bg-primary/5 text-t2 whitespace-nowrap"
          >
            <CustomTableCell colSpan={3}>{customer.name}</CustomTableCell>
            <CustomTableCell className="font-mono -translate-x-1" colSpan={3}>
              {customer.id ? (
                <CopyButton
                  text={customer.id || ""}
                  className="bg-transparent text-t3 border-none px-1 shadow-none max-w-full"
                >
                  <span className="truncate">{customer.id}</span>
                </CopyButton>
              ) : (
                <span className="px-1 text-t3">NULL</span>
              )}
            </CustomTableCell>
            <CustomTableCell colSpan={3}>{customer.email}</CustomTableCell>
            <CustomTableCell colSpan={5}>
              {getCusProductsInfo(customer)}
            </CustomTableCell>
            <CustomTableCell colSpan={2} className="text-t3 text-xs ">
              {formatUnixToDateTime(customer.created_at).date}
              <span className="text-t3">
                {" "}
                {formatUnixToDateTime(customer.created_at,{ ampm: true, case: "lower" }).time}{" "}
              </span>
            </CustomTableCell>
            <CustomTableCell
              colSpan={1}
              className="text-t3 text-xs flex justify-end"
            >
              <CustomerRowToolbar customer={customer} />
            </CustomTableCell>
          </Link>
        </React.Fragment>
      ))}
    </>
  );
};

export const CustomTableCell = ({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) => {
  return (
    <div
      className={cn(
        colSpan ? `col-span-${colSpan}` : "col-span-3",
        "overflow-hidden text-ellipsis pr-1",
        className
      )}
    >
      {children}
    </div>
  );
};
