import net, { type Socket } from 'node:net';
import { setTimeout } from 'node:timers';

const PORT = 4000;
const SESSION_DURATION = 1000 * 5;

type SessionInfo = {
  socket?: Socket;
  ip: string;
  port: number;
  addr: string;
  timeoutId?: NodeJS.Timeout;
};

const session_store: Record<string, SessionInfo> = {};

function expire_session(socket: Socket, session: SessionInfo) {
  if (socket) {
    socket.write('Your session has expired.\r\n');
    socket.end();
  }
  delete session_store[session.addr];
}

function extend_session(socket: Socket, session: SessionInfo) {
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
  }

  session.timeoutId = setTimeout(
    () => expire_session(socket, session),
    SESSION_DURATION,
  );
}

function disconnect_all() {
  for (const session of Object.values(session_store)) {
    const socket = session.socket;
    if (socket) {
      socket.write('This chat has been ended. Goodbye.\r\n');
      socket.end();
    }
    delete session_store[session.addr];
  }
}

function handle_command(data: string): boolean {
  if (data === 'shutdown\r\n') {
    disconnect_all();
    return true;
  }
  return false;
}

function encode(data: string) {
  return data;
}

function decode(buffer: Buffer<ArrayBufferLike>) {
  return buffer.toString();
}

const server = net.createServer((socket) => {
  const ip = socket.remoteAddress!;
  const port = socket.remotePort!;
  const addr = `${ip}:${port}`;

  let session: SessionInfo;
  if (addr in session_store) {
    session = session_store[addr] as SessionInfo;
    session.socket = socket;
  } else {
    session = {
      socket,
      ip,
      port,
      addr,
      timeoutId: undefined,
    };
    session_store[addr] = session;
  }
  extend_session(socket, session);

  socket.on('data', (buffer) => {
    extend_session(socket, session);

    const data = decode(buffer);

    if (handle_command(data)) return;

    socket.write(data); // echo
  });

  socket.write(encode('Hello!\r\n'));
});

server.listen(PORT);
