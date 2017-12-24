interface Jq {
    [key: number]: HTMLElement;
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

