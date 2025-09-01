import { ErrCode } from "@autumn/shared";
import { StatusCodes } from "http-status-codes";
import { createStripeCusIfNotExists } from "@/external/stripe/stripeCusUtils.js";
import { createStripeCli } from "@/external/stripe/utils.js";
import { CusService } from "@/internal/customers/CusService.js";
import { OrgService } from "@/internal/orgs/OrgService.js";
import RecaseError from "@/utils/errorUtils.js";
import { routeHandler } from "@/utils/routerUtils.js";

export const handleCreateBillingPortal = async (req: any, res: any) =>
	routeHandler({
		req,
		res,
		action: "create_billing_portal",
		handler: async (req: any, res: any) => {
			const customerId = req.params.customer_id;
			const returnUrl = req.body.return_url;

			const [org, customer] = await Promise.all([
				OrgService.getFromReq(req),
				CusService.get({
					db: req.db,
					idOrInternalId: customerId,
					orgId: req.orgId,
					env: req.env,
				}),
			]);

			if (!customer) {
				throw new RecaseError({
					message: `Customer ${customerId} not found`,
					code: ErrCode.CustomerNotFound,
					statusCode: StatusCodes.NOT_FOUND,
				});
			}

			const stripeCli = createStripeCli({ org, env: req.env });

			if (!customer.processor?.id) {
				let newCus: Awaited<ReturnType<typeof createStripeCusIfNotExists>>;
				try {
					newCus = await createStripeCusIfNotExists({
						db: req.db,
						org,
						env: req.env,
						customer,
						logger: req.logtail,
					});

					if (!newCus) {
						throw new RecaseError({
							message: `Failed to create Stripe customer`,
							code: ErrCode.StripeError,
							statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
						});
					}

					const portal = await stripeCli.billingPortal.sessions.create({
						customer: newCus.id,
						return_url: returnUrl || org.stripe_config.success_url,
					});

					res.status(200).json({
						customer_id: customer.id,
						url: portal.url,
					});
				} catch (_error: unknown) {
					throw new RecaseError({
						message: `Failed to create Stripe customer`,
						code: ErrCode.StripeError,
						statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
					});
				}
			} else {
				const portal = await stripeCli.billingPortal.sessions.create({
					customer: customer.processor.id,
					return_url: returnUrl || org.stripe_config.success_url,
				});

				res.status(200).json({
					customer_id: customer.id,
					url: portal.url,
				});
			}
		},
	});
