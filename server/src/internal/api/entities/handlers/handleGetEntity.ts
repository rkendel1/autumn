import { routeHandler } from "@/utils/routerUtils.js";
import { APIVersion, EntityExpand, EntityResponseSchema } from "@autumn/shared";
import { OrgService } from "@/internal/orgs/OrgService.js";
import { parseEntityExpand } from "../entityUtils.js";
import { getEntityResponse } from "../getEntityUtils.js";
import { invoicesToResponse } from "@/internal/invoices/invoiceUtils.js";
import { orgToVersion } from "@/utils/versionUtils.js";
import * as traceroot from "traceroot-sdk-ts";

export const handleGetEntity = async (req: any, res: any) =>
  routeHandler({
    req,
    res,
    action: "getEntity",
    handler: async (req, res) => {
      const tracedFunction = traceroot.traceFunction(async () => {
        const entityId = req.params.entity_id as string;
        const customerId = req.params.customer_id as string;
        const expand = parseEntityExpand(req.query.expand);

        let { orgId, env, db, logger, features } = req;

        let org = await OrgService.getFromReq(req);
        let apiVersion = orgToVersion({
          org,
          reqApiVersion:
            req.apiVersion >= APIVersion.v1_1 ? req.apiVersion : APIVersion.v1_2,
        });

        // const start = performance.now();
        let { entities, customer, fullEntities, invoices } =
          await getEntityResponse({
            db,
            entityIds: [entityId],
            org,
            env,
            customerId,
            expand,
            entityId,
            apiVersion,
            features,
            logger,
          });
        // const end = performance.now();
        // logger.info(`getEntityResponse took ${(end - start).toFixed(2)}ms`);

        let entity = entities[0];
        let withInvoices = expand.includes(EntityExpand.Invoices);

        res.status(200).json(
          EntityResponseSchema.parse({
            ...entity,
            invoices: withInvoices
              ? invoicesToResponse({
                  invoices: invoices || [],
                  logger,
                })
              : undefined,
          })
        );
      }, { spanName: 'handleGetEntity' });
      
      return await tracedFunction();
    },
  });
