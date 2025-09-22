import chalk from "chalk";
import { AutumnCli } from "tests/cli/AutumnCli.js";
import { advanceProducts } from "tests/global.js";
import {
	checkProductIsScheduled,
	compareMainProduct,
} from "tests/utils/compare.js";
import { setupBefore } from "tests/before.js";
import { initCustomer } from "@/utils/scriptUtils/initCustomer.js";

// TEST MULTI INTERVAL DOWNGRADE
//
/*
CASE 1: Annual pro -> Annual starter
  - If attach annual starter, should schedule correctly [DONE]
  - If advance test clock, should downgrade correctly (to monthly starter) [DONE]
  - If cancel active subscription (on Stripe), should remove scheduled correctly [DONE]
  - If cancel scheduled subscription (on Stripe), should remove scheduled correctly [DONE]
  - If expire on dashboard, should remove scheduled correctly

  - If upgrade back to annual pro, should remove scheduled correctly [DONE]
  - If downgrade to monthly pro (switch downgrade), should be correct [DONE]
  - If downgrade to free (switch downgrade), should be correct
*/

const testCase = "downgrade9";

describe(`${chalk.yellowBright("downgrade9: Multi interval downgrade -- Annual pro -> Annual starter")}`, () => {
	let customerId = testCase;

	before(async function () {
		await setupBefore(this);
		await initCustomer({
			customerId,
			db: this.db,
			org: this.org,
			env: this.env,
			autumn: this.autumnJs,
			attachPm: "success",
			withTestClock: false,
		});
	});

	it("should attach annual pro", async function () {
		await AutumnCli.attach({
			customerId: customerId,
			productId: advanceProducts.gpuProAnnual.id,
		});

		let cusRes = await AutumnCli.getCustomer(customerId);
		compareMainProduct({
			sent: advanceProducts.gpuProAnnual,
			cusRes,
		});
	});

	it("should attach downgrade to annual starter", async function () {
		await AutumnCli.attach({
			customerId: customerId,
			productId: advanceProducts.gpuStarterAnnual.id,
		});

		let cusRes = await AutumnCli.getCustomer(customerId);
		checkProductIsScheduled({
			cusRes,
			product: advanceProducts.gpuStarterAnnual,
		});
	});
});

// describe(`${chalk.yellowBright("downgrade9: Multi interval downgrade -- Quarterly pro -> Monthly pro")}`, () => {
//   let customerId = testCase;
//   let stripeCli: Stripe;
//   let testClockId: string;

//   before(async function () {
//     const { testClockId: insertedTestClockId } =
//       await initCustomerWithTestClock({
//         customerId,
//         org: this.org,
//         env: this.env,
//         db: this.db,
//       });
//     testClockId = insertedTestClockId;
//     stripeCli = createStripeCli({
//       org: this.org,
//       env: this.env,
//     });
//   });

//   it("should attach quarterly pro", async function () {
//     let res = await AutumnCli.attach({
//       customerId: customerId,
//       productId: advanceProducts.gpuProQuarter.id,
//     });

//     let cusRes = await AutumnCli.getCustomer(customerId);
//     compareMainProduct({
//       sent: advanceProducts.gpuProQuarter,
//       cusRes,
//     });
//   });

//   it("should attach downgrade to monthly pro", async function () {
//     let res = await AutumnCli.attach({
//       customerId: customerId,
//       productId: advanceProducts.gpuSystemPro.id,
//     });

//     let cusRes = await AutumnCli.getCustomer(customerId);
//     checkProductIsScheduled({
//       cusRes,
//       product: advanceProducts.gpuSystemPro,
//     });
//   });
// });
