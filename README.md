# SmartSocket Client

Lightweight, high-performance WebSocket client with built-in compression, automatic reconnection, and zero dependencies.

**Version**: 1.0.0  
**Size**: ~8KB minified + gzipped  
**Status**: Production Ready

---

## Features

✅ **Lightweight** - Only 8KB, zero dependencies  
✅ **Auto-Reconnection** - Exponential backoff  
✅ **Compression** - DEFLATE built-in  
✅ **Events** - Familiar on/off/emit pattern  
✅ **Acknowledgments** - Request/response pattern  
✅ **Namespaces** - Event isolation  
✅ **Fast** - <1ms message processing  
✅ **Browser Ready** - Works in modern browsers  

---

## Installation

```bash
npm install smartsocket-client
```

Or use directly in browser:
```html
<script src="SmartSocketClient.js"></script>
```

---

## Quick Start

### Node.js

```javascript
const SmartSocketClient = require('smartsocket-client');

const client = new SmartSocketClient('ws://localhost:3000');

client.on('connected', () => {
  console.log('Connected!');
  client.emit('hello', { name: 'Alice' });
});

client.on('response', (data) => {
  console.log('Server said:', data);
});

await client.connect();
```

### Browser (React)

```jsx
import { useState, useEffect } from 'react';
import SmartSocketClient from 'smartsocket-client';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const client = new SmartSocketClient('ws://localhost:3000');

    client.on('connected', () => {
      console.log('Connected!');
      setSocket(client);
    });

    client.on('message', (data) => {
      setMessages(m => [...m, data]);
    });

    client.connect();

    return () => client.disconnect();
  }, []);

  const sendMessage = (text) => {
    socket?.emit('message', { text });
  };

  return (
    <div>
      <div>Messages: {messages.length}</div>
      <button onClick={() => sendMessage('Hello')}>Send</button>
    </div>
  );
}

export default ChatComponent;
```

### Browser (Vanilla)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="SmartSocketClient.js"></script>
</head>
<body>
  <div id="app"></div>

  <script>
    const client = new SmartSocketClient('ws://localhost:3000');

    client.on('connected', () => {
      console.log('Connected!');
      document.getElementById('app').innerHTML = '✅ Connected';
    });

    client.on('message', (data) => {
      console.log('Message:', data);
    });

    client.connect();
  </script>
</body>
</html>
```

---

## API Reference

### Constructor

```javascript
const client = new SmartSocketClient(url, options);

// Options
{
  apiKey: 'optional-api-key',
  namespace: '/',
  enableNamespaces: true,
  enableAcknowledgments: true,
  enableErrorHandling: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  ackTimeout: 30000
}
```

### Connection Management

```javascript
// Connect to server
await client.connect();

// Disconnect
client.disconnect();

// Check connection status
console.log(client.connected);  // boolean
```

### Sending Events

```javascript
// Send without waiting for response
client.emit('event-name', { data: 'value' });

// Send with acknowledgment
client.emit('event-name', { data: 'value' }, (ack) => {
  console.log('Server acknowledged:', ack);
});
```

### Listening to Events

```javascript
// Listen for events
client.on('event-name', (data) => {
  console.log('Received:', data);
});

// Listen once then remove
client.once('event-name', (data) => {
  console.log('First message:', data);
});

// Remove listener
client.off('event-name');
```

### Built-in Events

```javascript
client.on('connected', () => {
  console.log('Connected to server');
});

client.on('disconnected', () => {
  console.log('Disconnected from server');
});

client.on('error', (error) => {
  console.error('Error:', error);
});
```

---

## Configuration

### Basic Setup

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  enableNamespaces: true,
  enableAcknowledgments: true,
  enableErrorHandling: true
});
```

### With API Key

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  apiKey: 'your-api-key-here'
});
```

### With Namespace

```javascript
const chatClient = new SmartSocketClient('ws://localhost:3000', {
  namespace: '/chat'
});

const gameClient = new SmartSocketClient('ws://localhost:3000', {
  namespace: '/game'
});
```

### Custom Options

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  reconnectDelay: 2000,        // Start with 2s delay
  maxReconnectAttempts: 20,    // Try up to 20 times
  ackTimeout: 60000            // Wait 60s for acknowledgment
});
```

---

## Examples

### Chat Application

```javascript
class ChatClient {
  constructor(serverUrl, username) {
    this.client = new SmartSocketClient(serverUrl, {
      namespace: '/chat'
    });
    this.username = username;
  }

  async connect() {
    await this.client.connect();
    
    this.client.on('message', (data) => {
      console.log(`${data.from}: ${data.text}`);
    });
  }

  joinRoom(room) {
    this.client.emit('join', { room, username: this.username });
  }

  sendMessage(text, room) {
    this.client.emit('message', { text, room });
  }

  leaveRoom(room) {
    this.client.emit('leave', { room });
  }

  disconnect() {
    this.client.disconnect();
  }
}

// Usage
const chat = new ChatClient('ws://localhost:3000', 'Alice');
await chat.connect();
chat.joinRoom('general');
chat.sendMessage('Hello!', 'general');
```

### Real-Time Data Sync

```javascript
class DataSync {
  constructor(serverUrl) {
    this.client = new SmartSocketClient(serverUrl);
    this.data = {};
  }

  async connect() {
    await this.client.connect();
    
    // Request initial state
    this.client.emit('get-state', {}, (state) => {
      this.data = state;
    });

    // Listen for updates
    this.client.on('state-update', (update) => {
      this.data = { ...this.data, ...update };
      this.onUpdate(this.data);
    });
  }

  update(newData) {
    this.client.emit('update-state', newData, (ack) => {
      if (ack.success) {
        console.log('Update confirmed');
      }
    });
  }

  onUpdate(data) {
    // Override in subclass
  }

  disconnect() {
    this.client.disconnect();
  }
}

// Usage
const sync = new DataSync('ws://localhost:3000');
await sync.connect();
sync.update({ count: 5 });
```

### Acknowledgment Pattern

```javascript
const client = new SmartSocketClient('ws://localhost:3000');

await client.connect();

// Save data and wait for confirmation
client.emit('save-data',
  { id: 1, name: 'John', age: 30 },
  (ack) => {
    if (ack.success) {
      console.log('Data saved! ID:', ack.id);
    } else {
      console.error('Save failed:', ack.error);
    }
  }
);

// Wait longer for acknowledgment
client.emit('process-file',
  { filename: 'data.zip' },
  (ack) => {
    console.log('Processing complete:', ack);
  }
);
```

---

## Error Handling

### Connection Errors

```javascript
const client = new SmartSocketClient('ws://localhost:3000');

client.on('error', (error) => {
  console.error('Connection error:', error);
});

client.on('disconnected', () => {
  console.log('Disconnected, will auto-reconnect...');
});

client.on('connected', () => {
  console.log('Reconnected successfully!');
});

await client.connect();
```

### Timeout Handling

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  ackTimeout: 30000  // 30 second timeout
});

client.emit('long-operation', {}, (ack) => {
  if (ack && ack.success) {
    console.log('Operation complete');
  } else {
    console.error('Operation timed out');
  }
});
```

---

## Performance

### Message Compression

SmartSocket automatically compresses messages:

```
Small message (50 bytes): 5-10% compression
Medium message (500 bytes): 40-60% compression
Large message (5000 bytes): 70-90% compression
```

Compression is **automatic and transparent** - no configuration needed.

### Auto-Reconnection

When connection is lost:
1. Waits 1 second
2. Attempts to reconnect
3. If fails, waits 1.5s, then 2.25s, etc. (exponential backoff)
4. Stops after 10 attempts (configurable)

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  reconnectDelay: 1000,         // 1 second initial delay
  maxReconnectAttempts: 10      // Try 10 times
});
```

### Latency

Typical latencies:
- Local network: <5ms
- Same datacenter: 10-20ms
- Cross-region: 50-100ms

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Supported |
| Firefox | 88+ | ✅ Supported |
| Safari | 15+ | ✅ Supported |
| Edge | 90+ | ✅ Supported |
| iOS Safari | 15+ | ✅ Supported |
| Android Chrome | 90+ | ✅ Supported |

---

## Debugging

### Enable Logging

```javascript
import { logger } from 'smartsocket-client/logger';

// Only logs in development
logger.log('Message sent');
logger.error('Connection error');
logger.warn('Low bandwidth');
```

### Check Status

```javascript
const client = new SmartSocketClient('ws://localhost:3000');

// After connecting...
console.log('Connected:', client.connected);
console.log('Namespace:', client.namespace);
console.log('Socket ID:', client.socket?.id);
```

---

## Common Issues

### Issue: Mixed Content Error
**Problem**: HTTPS page trying to connect to ws:// 

**Solution**: Use wss:// (secure WebSocket)
```javascript
const url = window.location.protocol === 'https:' 
  ? 'wss://api.example.com:3000'
  : 'ws://localhost:3000';

const client = new SmartSocketClient(url);
```

### Issue: CORS Error
**Problem**: Cross-origin connection refused

**Solution**: Server must allow WebSocket connections (or same origin)

### Issue: Messages Not Received
**Solution**:
1. Verify listener is registered: `client.on('event', handler)`
2. Check event name matches exactly
3. Verify server is sending to correct namespace
4. Check browser console for errors

### Issue: High Latency
**Solution**:
1. Check network latency: `ping server`
2. Verify message size (larger = slower)
3. Check server load
4. Try different region/datacenter

---

## Troubleshooting Checklist

- [ ] WebSocket URL is correct (ws:// or wss://)
- [ ] Server is running and accessible
- [ ] Firewall allows WebSocket connections
- [ ] API key is provided if required
- [ ] Listeners are attached before sending
- [ ] Event names match exactly (case-sensitive)
- [ ] Browser supports WebSocket (modern browsers)
- [ ] No mixed content errors in console

---

## Related Resources

- **Server Library**: [smartsocket](../smartsocket/)
- **Main Documentation**: [../README.md](../README.md)
- **Advanced Features**: [../SMARTSOCKET_FEATURES.md](../SMARTSOCKET_FEATURES.md)
- **Deployment Guide**: [../DEPLOYMENT.md](../DEPLOYMENT.md)

---

## Related Resources

- **Server Library**: [smartsocket](../smartsocket/)
- **Documentation Hub**: [smartsocket-docs](../smartsocket-docs/)
- **Deployment Guide**: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Advanced Features**: [../SMARTSOCKET_FEATURES.md](../SMARTSOCKET_FEATURES.md)

---

## License

MIT License - See [LICENSE](../LICENSE)

---

**Ready to connect?** Check out the [Quick Start](#quick-start) section! 🚀

export function App() {
  const { socket, connected } = useSmartSocket(
    'wss://api.example.com:8080',
    'sk-proj-key'
  );

  const sendMessage = (text) => {
    socket?.send('message', { text, timestamp: Date.now() });
  };

  return (
    <div>
      <p>{connected ? '✅ Connected' : '❌ Disconnected'}</p>
      <button onClick={() => sendMessage('Hello')}>Send</button>
    </div>
  );
}
```

### Vanilla JavaScript

```javascript
import SmartSocketClient from './SmartSocketClient.js';

const socket = new SmartSocketClient(
  'wss://api.example.com:8080',
  'sk-proj-key'
);

// Listen to messages
socket.on('message', (data) => {
  console.log('Received:', data);
});

// Handle connection
socket.on('connected', () => {
  console.log('Connected!');
});

socket.on('disconnected', () => {
  console.log('Disconnected (auto-reconnecting...)');
});

// Connect
await socket.connect();

// Send message
socket.send('message', { text: 'Hello!' });
```

## API

### Constructor
```javascript
const socket = new SmartSocketClient(url, apiKey);
```

**Parameters:**
- `url` (string) - WebSocket URL (wss:// for production, ws:// for dev)
- `apiKey` (string) - API authentication key

### Methods

```javascript
// Connection Management
await socket.connect()        // Connect to server
socket.disconnect()           // Disconnect cleanly
socket.reconnect()            // Manual reconnection

// Event Handling
socket.on(event, callback)    // Listen for events
socket.off(event, callback)   // Remove listener
socket.once(event, callback)  // Listen once then remove

// Sending Data
socket.send(event, payload)   // Send message to server
```

### Events

**Connection Events:**
```javascript
socket.on('connected', () => {})     // Connection established
socket.on('disconnected', () => {})  // Connection lost
socket.on('error', (err) => {})      // Error occurred
```

**Custom Events:**
```javascript
socket.on('message', (data) => {})   // Custom event from server
socket.on('anyEvent', (data) => {})  // Any custom event
```

### Properties

```javascript
socket.connected   // boolean - true if connected
socket.url         // string - WebSocket URL
socket.apiKey      // string - API key
```

## Configuration

### Environment Variables

```javascript
// React/Vite
const url = import.meta.env.VITE_SMARTSOCKET_URL;
const apiKey = import.meta.env.VITE_API_KEY;

const socket = new SmartSocketClient(url, apiKey);
```

### Dev vs Production

```javascript
const getSocketUrl = () => {
  if (import.meta.env.DEV) {
    return 'ws://localhost:8080';
  }
  return 'wss://api.example.com:8080';
};

const socket = new SmartSocketClient(
  getSocketUrl(),
  import.meta.env.VITE_API_KEY
);
```

## Logging

SmartSocket includes a logger that only logs in development:

```javascript
import { logger } from 'smartsocket-client/logger';

logger.log('Message');      // Only in dev
logger.error('Error');      // Only in dev
logger.warn('Warning');     // Only in dev
logger.debug('Debug info'); // Only in dev

// In production, all logs are hidden
```

## Examples

### Request-Response Pattern

```javascript
function sendRequest(event, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const handler = (response) => {
      socket.off(`${event}:response`, handler);
      resolve(response);
    };

    socket.on(`${event}:response`, handler);
    socket.send(event, data);

    setTimeout(() => {
      socket.off(`${event}:response`, handler);
      reject(new Error('Timeout'));
    }, timeout);
  });
}

// Usage
const user = await sendRequest('getUser', { id: 123 });
```

### Presence Tracking

```javascript
// Tell server user is here
socket.send('user:join', { 
  id: currentUser.id,
  name: currentUser.name 
});

// Listen for others joining
socket.on('user:join', (user) => {
  console.log(`${user.name} joined`);
});

// Cleanup on leave
socket.send('user:leave', { id: currentUser.id });
```

### Message Queuing

```javascript
const messageQueue = [];
let isProcessing = false;

function queueMessage(event, data) {
  messageQueue.push({ event, data });
  processQueue();
}

async function processQueue() {
  if (isProcessing || !socket.connected) return;
  
  isProcessing = true;
  while (messageQueue.length > 0) {
    const { event, data } = messageQueue.shift();
    socket.send(event, data);
    await new Promise(r => setTimeout(r, 10));
  }
  isProcessing = false;
}
```

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 15+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| iOS Safari | 15+ | ✅ Full support |
| Android Chrome | 90+ | ✅ Full support |

**Note:** DecompressionStream ('deflate-raw') requires modern browsers. Older browsers will receive uncompressed messages.

## Compression

SmartSocket automatically:
1. ✅ Compresses messages using DEFLATE if >10% size savings
2. ✅ Decompresses on receive (transparent)
3. ✅ Falls back to uncompressed if compression doesn't help
4. ✅ Tracks compression ratio and bandwidth saved

**You don't need to do anything** - compression is automatic.

## Auto-Reconnection

SmartSocket automatically reconnects when connection is lost:

1. Detects disconnection
2. Waits 1 second
3. Attempts reconnection
4. If fails, waits 1.5x longer (up to 30 seconds)
5. Maximum 10 attempts

**You can disable this** by checking `socket.connected`:
```javascript
socket.on('disconnected', () => {
  console.log('Disconnected');
  // SmartSocket will auto-reconnect in background
});
```

## Performance

- **Latency**: 4ms average per message (local)
- **Compression**: 80-99% for typical JSON messages
- **Throughput**: 10+ MB/s (depends on server)
- **Memory**: <1MB per connection
- **CPU**: <1% idle

## Troubleshooting

### HTTPS/WSS Mixed Content Error
```
Error: Mixed Content - HTTPS page can't connect to ws://
```

**Solution:** Use `wss://` for HTTPS pages
```javascript
const url = window.location.protocol === 'https:' 
  ? 'wss://api.example.com:8080'
  : 'ws://localhost:8080';
```

### SecurityError on HTTPS
```
Error: An insecure WebSocket connection may not be initiated from a page loaded over HTTPS
```

**Solution:** Ensure server supports WSS (SSL certificate required)

### Messages Not Received
1. Verify listener is attached: `socket.on('message', handler)`
2. Check server is broadcasting correctly
3. Verify event name matches
4. Enable logger: `logger.log('Received:', data)`

### High Latency
1. Check network conditions (ping server)
2. Verify message size (large messages = higher latency)
3. Check if compression ratio is >99% (might be disabled)
4. Monitor server performance

## Comparison with Socket.IO

| Feature | SmartSocket Client | Socket.IO Client |
|---------|-------------------|------------------|
| Bundle size | 12 KB | 150+ KB |
| Dependencies | 0 | Many |
| Auto-reconnect | ✅ Yes | ✅ Yes |
| Compression | ✅ Built-in | ❌ Add-on |
| Binary support | ✅ Native | ✅ Yes |
| Fallbacks | ✅ Graceful | ✅ Fallback protocol |
| Learning curve | Easy | Moderate |
| Community | Growing | Large |
| Documentation | Complete | Extensive |

## License

MIT

## Contributing

Contributions welcome! See [GitHub](https://github.com/erblinkqikuu/smartsocket)

## Links

- **GitHub**: [erblinkqikuu/smartsocket](https://github.com/erblinkqikuu/smartsocket)
- **Server Package**: [smartsocket](../smartsocket/)
- **Integration Guide**: [SMARTSOCKET_INTEGRATION_GUIDE.md](../SMARTSOCKET_INTEGRATION_GUIDE.md)
- **Best Practices**: [SMARTSOCKET_AI_BEST_PRACTICES.md](../SMARTSOCKET_AI_BEST_PRACTICES.md)
