interface Jq {
    [key: number]: HTMLElement;
    
    width(): number;
    height(): number;
    
    css(prop: string): string;
    css(prop: string, value: string|number): this;
    css(props: { [prop: string]: string|number }): this;
    
    html(): string;
    html(value: string): this;

    text(): string;
    text(value: string): this;

    append(value: Jq|string): this;
    appendTo(other: Jq): this;
    
    attr(attrib: string): any;
    attr(attrib: string, value: any): this;
    
    addClass(cls: string): this;
    removeClass(cls: string): this;
    
    show(): this;
    hide(): this;
    
    // easing?: string, cb?: () => void
    animate(props: object, duration: number, ...args: any[]): this;
    
    on<T extends Event>(event: string, handler: (e?: JqEvent<T>) => void): this;
    bind<T extends Event>(event: string, handler: (e?: JqEvent<T>) => void): this;
    click<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    load<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    mouseenter<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    mouseleave<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    off(event: string): this;
    
    scrollLeft(): number;
    scrollLeft(_: number): this;

    scrollTop(): number;
    scrollTop(_: number): this;

    offset(): { left: string; top: string };
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
    ajax: (path: string, options: any) => void;
    extend: any;
};

declare var $: JQuery;

