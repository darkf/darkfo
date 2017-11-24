from eventlet import wsgi, websocket
import eventlet
import json, time, string, os
import signal

# For ^C on Windows
signal.signal(signal.SIGINT, signal.SIG_DFL)

def is_valid_name_char(c):
    return c in string.ascii_letters + string.digits + "-_"

"""
sessions = {}

def broadcast_to_user_sessions(username, t, msg):
    global sessions

    for session in user_sessions(username):
        try:
            session.send(t, msg)
        except OSError:
            session.disconnected("Broken pipe")
"""

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
        return json.loads(self.sock.wait())

    def recv(self):
        data = self.sock.wait()
        if data is None:
            raise EOFError()
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

        self.send("map", { "map": context.serializedMap,
                           "player": {"position": self.pos, "elevation": context.elevation, "uid": self.uid},
                           "hostPlayer": {"position": context.host.pos, "uid": context.host.uid, "name": context.host.name, "orientation": context.host.orientation}
                         })
    
    def serve(self):
        global context

        self.send("hello", {"network": {"name": "test server"}})

        try:
            while True:
                t, msg = self.recv()
                print("Received %s message from %r" % (t, self.name))

                if t == "ident":
                    self.name = msg["name"]
                    print("Client identified as", msg["name"])

                elif t == "changeMap":
                    context.serializedMap = msg["map"]
                    context.elevation = msg["player"]["elevation"]
                    self.pos = msg["player"]["position"]
                    self.orientation = msg["player"]["orientation"]
                    
                    print("Map changed to", msg["mapName"])

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

                    # Relay movement to the other party
                    target = context.host
                    if self.is_host:
                        target = context.guest

                    target.send("movePlayer", { "uid": self.uid, "position": {"x": msg["x"], "y": msg["y"]} })

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