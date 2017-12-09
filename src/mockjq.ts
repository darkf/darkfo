interface Jq {
    width(): number;
    height(): number;
    
    css(prop: string, value: string|number): this;
    css(props: { [prop: string]: string|number }): this;

    html(value: string): this;
    append(value: Jq|string): this;

    attr(attrib: string, value: any): this;

    on<T extends Event>(event: string, handler: (e?: JqEvent<T>) => void): this;
    click<T extends Event>(_: (e?: JqEvent<T>) => void): this;
    
    scrollLeft(_: number): this;
    scrollTop(_: number): this;
}

interface JqEvent<EventType extends Event> {
    originalEvent: EventType;

    pageX: number;
    pageY: number;
    stopPropagation(): void;
}
