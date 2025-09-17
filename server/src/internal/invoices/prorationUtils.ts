import { formatUnixToDate } from "@/utils/genUtils.js";
import { Decimal } from "decimal.js";

export type Proration = {
  start: number;
  end: number;
};

export const calculateProrationAmount = ({
  periodEnd,
  periodStart,
  now,
  amount,
  allowNegative = false,
}: {
  periodEnd: number;
  periodStart: number;
  now: number;
  amount: number;
  allowNegative?: boolean;
}) => {
  const num = new Decimal(periodEnd).minus(now);
  const denom = new Decimal(periodEnd).minus(periodStart);

  const proratedAmount = num.div(denom).mul(amount);

  if (proratedAmount.lte(0) && !allowNegative) {
    return 0;
  }

  return proratedAmount.toNumber();
};
