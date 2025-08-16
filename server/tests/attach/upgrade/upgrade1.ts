import chalk from "chalk";
import { setupBefore } from "tests/before.js";
import { Stripe } from "stripe";
import { createProducts } from "tests/utils/productUtils.js";
import { constructProduct } from "@/utils/scriptUtils/createTestProducts.js";
import { TestFeature } from "tests/setup/v2Features.js";
import { AutumnInt } from "@/external/autumn/autumnCli.js";
import { initCustomer } from "@/utils/scriptUtils/initCustomer.js";
import { APIVersion, AppEnv, Organization } from "@autumn/shared";
import { constructArrearItem } from "@/utils/scriptUtils/constructItem.js";
import { advanceTestClock } from "tests/utils/stripeUtils.js";
import { addWeeks } from "date-fns";
import { DrizzleCli } from "@/db/initDrizzle.js";
import { attachAndExpectCorrect } from "tests/utils/expectUtils/expectAttach.js";
import { addPrefixToProducts } from "tests/utils/testProductUtils/testProductUtils.js";

// UNCOMMENT FROM HERE
let pro = constructProduct({
  id: "pro",
  items: [constructArrearItem({ featureId: TestFeature.Words })],
  type: "pro",
});
let premium = constructProduct({
  id: "premium",
  items: [constructArrearItem({ featureId: TestFeature.Words })],
  type: "premium",
});
let growth = constructProduct({
  id: "growth",
  items: [constructArrearItem({ featureId: TestFeature.Words })],
  type: "growth",
});

describe(`${chalk.yellowBright("upgrade1: Testing usage upgrades")}`, () => {
  let customerId = "upgrade1";
  let autumn: AutumnInt = new AutumnInt({ version: APIVersion.v1_4 });

  let stripeCli: Stripe;
  let testClockId: string;
  let curUnix: number;
  let db: DrizzleCli;
  let org: Organization;
  let env: AppEnv;

  before(async function () {
    await setupBefore(this);
    const { autumnJs } = this;
    db = this.db;
    org = this.org;
    env = this.env;

    stripeCli = this.stripeCli;

    addPrefixToProducts({
      products: [pro, premium, growth],
      prefix: customerId,
    });

    await createProducts({
      autumn: autumnJs,
      products: [pro, premium, growth],
      db,
      orgId: org.id,
      env,
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

  it("should attach premium product", async function () {
    const wordsUsage = 100000;
    await autumn.track({
      customer_id: customerId,
      feature_id: TestFeature.Words,
      value: wordsUsage,
    });

    curUnix = await advanceTestClock({
      stripeCli,
      testClockId,
      advanceTo: addWeeks(new Date(), 2).getTime(),
      waitForSeconds: 10,
    });

    await attachAndExpectCorrect({
      autumn,
      customerId,
      product: premium,
      stripeCli,
      db,
      org,
      env,
    });
  });

  it("should attach growth product", async function () {
    const wordsUsage = 200000;
    await autumn.track({
      customer_id: customerId,
      feature_id: TestFeature.Words,
      value: wordsUsage,
    });

    curUnix = await advanceTestClock({
      stripeCli,
      testClockId,
      advanceTo: addWeeks(curUnix, 1).getTime(),
      waitForSeconds: 10,
    });

    await attachAndExpectCorrect({
      autumn,
      customerId,
      product: growth,
      stripeCli,
      db,
      org,
      env,
    });
  });
});
