module Events {
    export type EventHandler = (e: any) => void;

    const handlers: { [msgType: string]: EventHandler[] } = {};

    export function on(msgType: string, handler: EventHandler): void {
        console.log("ON: %s -> %o", msgType, handler)
        if(msgType in handlers)
            handlers[msgType].push(handler);
        else
            handlers[msgType] = [handler];
    }

    export function emit(msgType: string, msg?: any): void {
        console.log("Event %s emitted", msgType);
        if(msgType in handlers) {
            for(const handler of handlers[msgType])
                handler(msg);
        }
    }
}
