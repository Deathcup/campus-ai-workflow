import type { RuntimeEvent } from "@campus-ai/contracts";

type Listener = (event: RuntimeEvent) => void;

export class EventBroker {
  private readonly listeners = new Map<string, Set<Listener>>();

  publish(event: RuntimeEvent): void {
    for (const listener of this.listeners.get(event.sessionId) ?? []) listener(event);
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(sessionId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(sessionId);
    };
  }
}
