/*
Copyright 2017 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Event manager

module Events {
    export type EventHandler = (e: any) => void;

    const handlers: { [msgType: string]: EventHandler[] } = {};

    export function on(msgType: string, handler: EventHandler): void {
        if(msgType in handlers)
            handlers[msgType].push(handler);
        else
            handlers[msgType] = [handler];
    }

    export function emit(msgType: string, msg?: any): void {
        if(msgType in handlers) {
            for(const handler of handlers[msgType])
                handler(msg);
        }
    }
}
