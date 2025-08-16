// Handling per entity features!

import {
  APIVersion,
  AppEnv,
  LimitedItem,
  Organization,
  ProductItem,
} from "@autumn/shared";

import { TestFeature } from "tests/setup/v2Features.js";
import { expect } from "chai";
import { timeout } from "@/utils/genUtils.js";
import { AutumnInt } from "@/external/autumn/autumnCli.js";
import { initCustomer } from "@/utils/scriptUtils/initCustomer.js";

import chalk from "chalk";
import Stripe from "stripe";
import { DrizzleCli } from "@/db/initDrizzle.js";
import { setupBefore } from "tests/before.js";
import { createProducts } from "tests/utils/productUtils.js";
import { addPrefixToProducts } from "../../attach/utils.js";
import { attachAndExpectCorrect } from "tests/utils/expectUtils/expectAttach.js";
import { constructProduct } from "@/utils/scriptUtils/createTestProducts.js";
import { constructFeatureItem } from "@/utils/scriptUtils/constructItem.js";
import { Decimal } from "decimal.js";

let user = TestFeature.Users;
let admin = TestFeature.Admin;

let userMessages = constructFeatureItem({
  featureId: TestFeature.Messages,
  includedUsage: 100,
  entityFeatureId: user,
}) as LimitedItem;

let adminMessages = constructFeatureItem({
  featureId: TestFeature.Messages,
  includedUsage: 500,
  entityFeatureId: admin,
}) as LimitedItem;

let adminRights = constructFeatureItem({
  featureId: TestFeature.AdminRights,
  entityFeatureId: admin,
  isBoolean: true,
}) as ProductItem;

export let pro = constructProduct({
  items: [userMessages, adminMessages, adminRights],
  type: "pro",
});

const testCase = "role1";

describe(`${chalk.yellowBright(`contUse/${testCase}: Testing roles`)}`, () => {
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
      autumn,
      products: [pro],
      customerId,
      db,
      orgId: org.id,
      env,
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

  let userId = "user1";
  let adminId = "admin1";
  let firstEntities = [
    {
      id: userId,
      name: "test",
      feature_id: user,
    },
    {
      id: adminId,
      name: "test",
      feature_id: admin,
    },
  ];

  it("should create initial entities, then attach pro", async function () {
    await autumn.entities.create(customerId, firstEntities);

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

  it("should have correct check result for admin rights", async function () {
    let { allowed } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.AdminRights,
      entity_id: adminId,
    });

    let entity = await autumn.entities.get(customerId, adminId);

    expect(allowed).to.equal(true);
    expect(entity.features[TestFeature.AdminRights]).exist;

    let { allowed: userAllowed } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.AdminRights,
      entity_id: userId,
    });
    let userEntity = await autumn.entities.get(customerId, userId);

    expect(userAllowed).to.equal(false);
    expect(userEntity.features[TestFeature.AdminRights]).not.exist;
  });

  it("should have correct total balance", async function () {
    let { balance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
    });

    let totalIncluded =
      userMessages.included_usage + adminMessages.included_usage;

    expect(balance).to.equal(totalIncluded);
  });

  it("should have correct per entity balance", async function () {
    let { balance: userBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: userId,
    });

    let userEntity = await autumn.entities.get(customerId, userId);

    expect(userBalance).to.equal(userMessages.included_usage);
    expect(userEntity.features[TestFeature.Messages].included_usage).to.equal(
      userMessages.included_usage
    );

    let { balance: adminBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: adminId,
    });

    let adminEntity = await autumn.entities.get(customerId, adminId);

    expect(adminBalance).to.equal(adminMessages.included_usage);
    expect(adminEntity.features[TestFeature.Messages].included_usage).to.equal(
      adminMessages.included_usage
    );
  });

  let userUsage = Math.random() * 50;
  let expectedUserBalance = new Decimal(userMessages.included_usage)
    .minus(userUsage)
    .toNumber();
  it("should have correct user usage", async function () {
    await autumn.track({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      value: userUsage,
      entity_id: userId,
    });
    await timeout(2000);

    let { balance: userBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: userId,
    });

    let { balance: adminBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: adminId,
    });

    expect(adminBalance).to.equal(adminMessages.included_usage);
    expect(userBalance).to.equal(expectedUserBalance);
  });

  let adminUsage = Math.random() * 50;
  let expectedAdminBalance = new Decimal(adminMessages.included_usage)
    .minus(adminUsage)
    .toNumber();
  it("Should have correct admin usage", async function () {
    await autumn.track({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      value: adminUsage,
      entity_id: adminId,
    });
    await timeout(2000);

    let { balance: adminBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: adminId,
    });

    let { balance: userBalance } = await autumn.check({
      customer_id: customerId,
      feature_id: TestFeature.Messages,
      entity_id: userId,
    });

    expect(adminBalance).to.equal(expectedAdminBalance);
    expect(userBalance).to.equal(expectedUserBalance);
  });
});
