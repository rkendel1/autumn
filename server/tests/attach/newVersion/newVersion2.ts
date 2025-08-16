import { expect } from "chai";
import { AutumnInt } from "@/external/autumn/autumnCli.js";
import { initCustomer } from "@/utils/scriptUtils/initCustomer.js";
import {
  APIVersion,
  AppEnv,
  BillingInterval,
  Organization,
  ProductV2,
} from "@autumn/shared";
import chalk from "chalk";
import Stripe from "stripe";
import { DrizzleCli } from "@/db/initDrizzle.js";
import { setupBefore } from "tests/before.js";
import { createProducts } from "tests/utils/productUtils.js";
import { addPrefixToProducts } from "../utils.js";
import { constructProduct } from "@/utils/scriptUtils/createTestProducts.js";
import { constructArrearItem } from "@/utils/scriptUtils/constructItem.js";
import { TestFeature } from "tests/setup/v2Features.js";
import { replaceItems } from "../utils.js";
import { constructPriceItem } from "@/internal/products/product-items/productItemUtils.js";
import runUpdateEntsTest from "../updateEnts/expectUpdateEnts.js";
import { attachAndExpectCorrect } from "tests/utils/expectUtils/expectAttach.js";

export let pro = constructProduct({
  items: [constructArrearItem({ featureId: TestFeature.Words })],
  type: "pro",
  trial: true,
});

const testCase = "newVersion2";

describe(`${chalk.yellowBright(`${testCase}: Testing attach new version for trial product`)}`, () => {
  let customerId = testCase;
  let autumn: AutumnInt = new AutumnInt({ version: APIVersion.v1_4 });
  let testClockId: string;
  let db: DrizzleCli, org: Organization, env: AppEnv;
  let stripeCli: Stripe;

  let curUnix = new Date().getTime();

  before(async function () {
    await setupBefore(this);
    const { autumnJs } = this;
    db = this.db;
    org = this.org;
    env = this.env;

    stripeCli = this.stripeCli;

    addPrefixToProducts({
      products: [pro],
      prefix: testCase,
    });

    await createProducts({
      db,
      orgId: org.id,
      env,
      autumn,
      products: [pro],
      customerId,
    });

    const { testClockId: testClockId1 } = await initCustomer({
      autumn: autumnJs,
      customerId,
      db,
      org,
      env,
      attachPm: "success",
    });

    testClockId = testClockId1!;
  });

  it("should attach pro product", async function () {
    await attachAndExpectCorrect({
      autumn,
      customerId,
      product: pro,
      stripeCli,
      db,
      org,
      env,
    });
  });

  let usage = 50000;
  let newPro: ProductV2;
  it("should update product to new version", async function () {
    newPro = structuredClone(pro);
    let newItems = replaceItems({
      items: pro.items,
      interval: BillingInterval.Month,
      newItem: constructPriceItem({
        price: 100,
        interval: BillingInterval.Month,
      }),
    });

    newPro.version = 2;
    newPro.items = newItems;

    await autumn.products.update(pro.id, {
      items: newItems,
    });
  });

  return;

  it("should attach pro v2", async function () {
    await runUpdateEntsTest({
      autumn,
      stripeCli,
      customerId,
      customProduct: newPro,
      newVersion: 2,
      db,
      org,
      env,
    });
  });

  // it("should have correct invoice total on next cycle", async function () {
  //   const invoiceTotal = await getExpectedInvoiceTotal({
  //     org,
  //     env,
  //     customerId,
  //     productId: pro.id,
  //     stripeCli,
  //     db,
  //     usage: [
  //       {
  //         featureId: TestFeature.Words,
  //         value: usage,
  //       },
  //     ],
  //     onlyIncludeMonthly: true,
  //   });

  //   let curUnix = Date.now();
  //   curUnix = await advanceTestClock({
  //     stripeCli,
  //     testClockId,
  //     advanceTo: addMonths(curUnix, 1).getTime(),
  //     waitForSeconds: 30,
  //   });

  //   await advanceTestClock({
  //     stripeCli,
  //     testClockId,
  //     advanceTo: addHours(curUnix, hoursToFinalizeInvoice).getTime(),
  //     waitForSeconds: 10,
  //   });

  //   const customer = await autumn.customers.get(customerId);
  //   const invoice = customer.invoices[0];
  //   expect(invoice.total).to.equal(
  //     invoiceTotal,
  //     "invoice total after 1 cycle should be correct"
  //   );
  // });
});
