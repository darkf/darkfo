interface Jq {
    [key: number]: HTMLElement;
                            
    on<T extends Event>(event: string, handler: (e?: JqEvent<T>) => void): this;
    bind<T extends Event>(event: string, handler: (e?: JqEvent<T>) => void): this;
    load<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    off(event: string): this;
}

interface JqEvent<EventType extends Event> {
    originalEvent: EventType;
    target: HTMLElement;
    
    pageX: number;
    pageY: number;
    stopPropagation(): void;
}

type JQueryFn = (_: string|HTMLElement) => Jq;
type JQuery = JQueryFn & {
    isNumeric: (_: string) => boolean;
    extend: any;
};

declare var $: JQuery;

