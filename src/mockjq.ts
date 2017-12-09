interface Jq {
    width(): number;
    height(): number;
    
    css(prop: string, value: string|number): this;
    css(props: { [prop: string]: string|number }): this;

    click(_: (e?: JqEvent) => void): this;
    
    scrollLeft(_: number): this;
    scrollTop(_: number): this;
}

interface JqEvent {
    pageX: number;
    pageY: number;
    stopPropagation(): void;
}
