import { navigateTo } from "@/utils/genUtils";
import {
  formatUnixToDateTime,
  formatUnixToDateTimeWithMs,
} from "@/utils/formatUtils/formatDateUtils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Row, Item } from "@/components/general/TableGrid";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router";
import { useCustomerContext } from "./CustomerContext";
import { cn } from "@/lib/utils";
import { useCusQuery } from "./hooks/useCusQuery";
import { useCusEventsQuery } from "./hooks/useCusEventsQuery";

export const CustomerEventsList = () => {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { customer_id } = useParams();
  const { showEntityView } = useCustomerContext();
  const { events, isLoading, error } = useCusEventsQuery();

  return (
    <div>
      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent className="w-fit !max-w-3xl p-4">
          <DialogTitle>Event Details</DialogTitle>
          <pre className="bg-stone-800 text-white p-4 rounded-md w-full">
            {JSON.stringify(selectedEvent, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <div className="items-center grid grid-cols-10 gap-8 justify-between border-y bg-stone-100 pl-10 pr-7 h-10">
        <h2 className="text-sm text-t2 font-medium col-span-2 flex">Events</h2>
        <div className="flex w-full h-full items-center col-span-8 justify-end">
          <div className="flex w-fit h-full items-center gap-4">
            <Button
              variant="analyse"
              onClick={() =>
                navigateTo(`/analytics?customer_id=${customer_id}`, navigate)
              }
            >
              Analyse Events
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex pl-10 items-center h-10">
          <p className="text-t3 text-sm shimmer">
            Loading events for this customer...
          </p>
        </div>
      ) : events && events.length === 0 ? (
        <div className="flex pl-10 items-center h-10">
          <p className="text-t3 text-sm">
            No events received for this customer
          </p>
        </div>
      ) : (
        <Row
          type="header"
          className={cn("grid-cols-12 pr-0", showEntityView && "grid-cols-15")}
        >
          <Item className="col-span-3">Event Name</Item>

          <Item className="col-span-3">Value</Item>
          <Item className="col-span-3">Status</Item>
          {showEntityView && <Item className="col-span-3"></Item>}
          <Item className="col-span-2">Timestamp</Item>
          <Item className="col-span-1" />
        </Row>
      )}

      {events &&
        events.map((event: any) => (
          <Row
            key={event.id}
            className={cn(
              "grid-cols-12 pr-0",
              showEntityView && "grid-cols-15"
            )}
            onClick={() => setSelectedEvent(event)}
          >
            <Item className="col-span-3 font-mono">{event.event_name}</Item>

            <Item className="col-span-3 relative">
              <span className="font-mono truncate">
                {event.value || event.properties.value || 1}
              </span>
            </Item>
            <Item className="col-span-3 font-mono">
              <span className="text-t3">POST </span>
              <span className="text-lime-600">200</span>
            </Item>
            {showEntityView && <Item className="col-span-3"></Item>}
            <Item className="col-span-2 text-t3 text-xs">
              <Tooltip>
                <TooltipTrigger>
                  {formatUnixToDateTime(event.timestamp).date}{" "}
                  {formatUnixToDateTime(event.timestamp).time}{" "}
                </TooltipTrigger>
                <TooltipContent>
                  {formatUnixToDateTimeWithMs(event.timestamp)}
                </TooltipContent>
              </Tooltip>
            </Item>
            <Item className="col-span-1" />
          </Row>
        ))}

      <p className="text-t3 text-xs w-full text-center mt-2">
        Showing last 10 events
      </p>
    </div>
  );
};
