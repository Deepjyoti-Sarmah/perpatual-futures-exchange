import { subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";

import { eventBuffer } from "./buffer";
import { processEvent } from "./process-event";

const DB_WRITER_GROUP = "db-writer-group";

export async function flushBuffer() {
  if (eventBuffer.length === 0) {
    return;
  }

  const batch = eventBuffer.splice(0, eventBuffer.length);

  try {
    for (const event of batch) {
      await processEvent(event.eventType, event.payload);
    }

    for (const event of batch) {
      await subscriberClient.xAck(
        ENGINE_EVENT_STREAM,
        DB_WRITER_GROUP,
        event.id,
      );
    }
  } catch (error) {
    eventBuffer.unshift(...batch);

    throw error;
  }
}
