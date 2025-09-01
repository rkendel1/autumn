import {
	FeatureId,
	isEntitled,
	sendProductEvent,
} from "@/external/autumn/autumnUtils.js";
import { handleRequestError } from "@/utils/errorUtils.js";

export const pricingMiddleware = async (req: any, res: any, next: any) => {
	const path = req.url;
	const method = req.method;

	const host = req.headers.host;
	if (host.includes("localhost")) {
		next();
		return;
	}

	try {
		if (path === "/products" && method === "POST") {
			await isEntitled({
				org: req.org,
				env: req.env,
				featureId: FeatureId.Products,
			});
		}

		next();

		if (res.statusCode === 200) {
			if (path === "/products" && method === "POST") {
				console.log("sending product create event");
				await sendProductEvent({
					org: req.org,
					env: req.env,
					incrementBy: 1,
				});
			}

			if (path.match(/^\/products\/[^/]+$/) && method === "DELETE") {
				console.log("sending product delete event");
				await sendProductEvent({
					org: req.org,
					env: req.env,
					incrementBy: -1,
				});
			}
		}
	} catch (error) {
		handleRequestError({ req, error, res, action: "pricingMiddleware" });
		return;
	}
};
