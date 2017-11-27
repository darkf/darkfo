"""
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
"""

# WebSocket server for DarkFO's multiplayer mode

from eventlet import wsgi, websocket
import eventlet
import json, zlib, time, string, os
import signal

# For ^C on Windows
signal.signal(signal.SIGINT, signal.SIG_DFL)

def is_valid_name_char(c):
    return c in string.ascii_letters + string.digits + "-_"

class GameContext:
    def __init__(self):
        self.host = None
        self.guest = None
        self.serializedMap = None
        self.elevation = None
        self.lastUID = 0

    def new_uid(self):
        uid = self.lastUID
        self.lastUID += 1
        return uid

context = GameContext()

# Connection handler
class Connection:
    def __init__(self, ws):
        self.sock = ws
        self.is_host = None
        self.uid = None
        self.name = None
        self.pos = None
        self.orientation = 0

    def _send(self, msg):
        self.sock.send(json.dumps(msg))

    def send(self, t, msg):
        msg.update({"t": t})
        self._send(msg)

    def _recv(self):
        msg = self.sock.wait()
        if type(msg) is bytes:
            return msg
        return json.loads(msg)

    def recv(self):
        data = self.sock.wait()
        if data is None:
            raise EOFError()
        if type(data) is bytes:
            return None, data
        msg = json.loads(data)
        return msg["t"], msg

    def disconnected(self, reason=""):
        print("client", self.name, "disconnected:", reason)
        # TODO: Broadcast drop out

    def error(self, request, msg):
        self.send("error", {"request": request, "message": msg})

    def sendMap(self):
        global context

        print("Sending map")

        self.pos = context.host.pos.copy()
        self.pos["x"] += 2

        # First send the map so the client has it in its buffer
        self.sock.send(context.serializedMap)

        # Then send the map change notification
        self.send("map", {
                           "player": {"position": self.pos, "elevation": context.elevation, "uid": self.uid},
                           "hostPlayer": {"position": context.host.pos, "uid": context.host.uid, "name": context.host.name, "orientation": context.host.orientation}
                         })

        self.moved()

    def moved(self):
        # Relay movement to the other party
        target = context.host
        if self.is_host:
            target = context.guest

        if target:
            target.send("movePlayer", { "uid": self.uid, "position": self.pos })

    def target(self):
        if self.is_host:
            return context.guest
        return context.host

    def relay(self, msg):
        target = self.target()
        if target:
            target.send(msg["t"], msg)
    
    def serve(self):
        global context

        self.send("hello", {"network": {"name": "test server"}})

        try:
            while True:
                t, msg = self.recv()
                print("Received %s message from %r" % (t, self.name))

                if t is None:
                    print("Received binary/compressed data -- assuming it's a map")

                    # We don't decompress it as we don't need the actual map data -- we can pass it along
                    # compressed to the guest clients as well.
                    context.serializedMap = msg

                elif t == "ident":
                    self.name = msg["name"]
                    print("Client identified as", msg["name"])

                elif t == "changeMap":
                    context.elevation = msg["player"]["elevation"]
                    self.pos = msg["player"]["position"]
                    self.orientation = msg["player"]["orientation"]
                    
                    print("Map changed to", msg["mapName"])

                    # Notify guest of map change and send map
                    if context.guest:
                        print("Notifying guest")
                        context.guest.sendMap()

                elif t == "changeElevation":
                    print("Elevation changed")

                    context.elevation = msg["elevation"]
                    self.pos = msg["position"]
                    self.orientation = msg["orientation"]

                    # Notify guest
                    if context.guest:
                        context.guest.send("elevationChanged", { "elevation": context.elevation })

                    self.moved()

                    context.guest.pos = self.pos.copy()
                    context.guest.pos["x"] += 2
                    context.guest.moved()


                elif t == "host":
                    context.host = self
                    self.is_host = True
                    self.uid = context.new_uid()

                    print("Got a host:", self.name)

                elif t == "join":
                    context.guest = self
                    print("Got a guest:", self.name)

                    self.is_host = False
                    self.uid = context.new_uid()

                    self.sendMap()

                    print("Notifying host")
                    context.host.send("guestJoined", {
                        "name": self.name,
                        "uid": self.uid,
                        "position": self.pos,
                        "orientation": self.orientation
                    })

                elif t == "moved":
                    print("%s moved" % ("host" if self.is_host else "guest"))

                    self.pos["x"] = msg["x"]
                    self.pos["y"] = msg["y"]
                    self.moved()

                elif t == "objSetOpen":
                    self.relay(msg)

                elif t == "close":
                    self.disconnected("close message received")
                    break
        except (EOFError, OSError):
            self.disconnected("socket closed")

@websocket.WebSocketWSGI
def connection(ws):
    con = Connection(ws)
    con.serve()

if __name__ == "__main__":
    wsgi.server(eventlet.listen(('', 8090)), connection)