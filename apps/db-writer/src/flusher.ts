import { subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";

import { eventBuffer } from "./buffer";
import { processEvent } from "./process-event";

const DB_WRITER_GROUP = "db-writer-group";

let flushing = false;

export async function flushBuffer() {
  if (eventBuffer.length === 0 || flushing) {
    return;
  }

  flushing = true;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  let lastSuccessIndex = -1;

  try {
    for (let i = 0; i < batch.length; i++) {
      const event = batch[i]!;
      await processEvent(event.eventType, event.payload);
      lastSuccessIndex = i;
    }

    // all succeeded — acknowledge everything
    for (const event of batch) {
      await subscriberClient.xAck(
        ENGINE_EVENT_STREAM,
        DB_WRITER_GROUP,
        event.id,
      );
    }
  } catch (error) {
    // acknowledge only the events that succeeded
    for (let i = 0; i <= lastSuccessIndex; i++) {
      await subscriberClient
        .xAck(ENGINE_EVENT_STREAM, DB_WRITER_GROUP, batch[i]!.id)
        .catch(console.error);
    }

    // re-queue only the events that weren't processed yet
    const unprocessed = batch.slice(lastSuccessIndex + 1);
    eventBuffer.unshift(...unprocessed);

    throw error;
  } finally {
    flushing = false;
  }
}
