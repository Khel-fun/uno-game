const logger = require('../logger');

class TrackingQueue {
  constructor({ flushMs = 2000, batchSize = 50, processEvent }) {
    this.flushMs = flushMs;
    this.batchSize = batchSize;
    this.processEvent = processEvent;
    this.events = [];
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        logger.error('[TrackingQueue] Flush failed: %s', err.message);
      });
    }, this.flushMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  enqueue(event) {
    this.events.push({
      ...event,
      enqueuedAt: Date.now(),
      attempts: event.attempts || 0,
    });

    if (this.events.length >= this.batchSize) {
      this.flush().catch((err) => {
        logger.error('[TrackingQueue] Immediate flush failed: %s', err.message);
      });
    }
  }

  getSize() {
    return this.events.length;
  }

  async flush() {
    if (this.events.length === 0) return;

    const batch = this.events.splice(0, this.batchSize);
    for (const event of batch) {
      try {
        await this.processEvent(event);
      } catch (error) {
        const attempts = (event.attempts || 0) + 1;
        logger.warn(
          '[TrackingQueue] Event processing failed (type=%s attempt=%d): %s',
          event.type,
          attempts,
          error.message
        );

        // Retry twice, then drop. Always fail-open.
        if (attempts < 3) {
          this.events.push({ ...event, attempts });
        } else {
          logger.error('[TrackingQueue] Dropping event after max retries (type=%s)', event.type);
        }
      }
    }
  }
}

module.exports = TrackingQueue;
