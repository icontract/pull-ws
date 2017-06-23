var ws = require('./')
var WebSocket = require('ws')
var url = require('url')
var http = require('http')
var https = require('https')

var EventEmitter = require('events').EventEmitter
if(!WebSocket.Server)
  return module.exports = null

module.exports = function (opts, onConnection) {
  var emitter = new EventEmitter()
  var server
  if (typeof opts === 'function'){
    onConnection = opts
    opts = null
  }
  opts = opts || {}

  if(onConnection)
    emitter.on('connection', onConnection)

  function proxy (server, event) {
    return server.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      emitter.emit.apply(emitter, args)
    })
  }

  var server = opts.server ||
    (opts.key && opts.cert ? https.createServer(opts) : http.createServer())

  var wsServer = new WebSocket.Server({
    server: server,
    perMessageDeflate: false,
    verifyClient: opts.verifyClient
  })

  proxy(server, 'listening')
  proxy(server, 'request')
  proxy(server, 'close')

  function heartbeat () {
    console.log('hearbeat.')
    this.isAlive = true
  }

  wsServer.on('connection', function (socket) {
    socket.isAlive = true;
    socket.on('pong', heartbeat);
    var stream = ws(socket)
    stream.remoteAddress = socket.upgradeReq.socket.remoteAddress
    emitter.emit('connection', stream)
  })

  var interval = setInterval(function ping() {
    wsServer.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        console.log('debug is alive.')
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping('', false, true);
    });
  }, 30000);

  emitter.listen = function (addr, onListening) {
    if(onListening)
      emitter.once('listening', onListening)
    server.listen(addr.port || addr)
    return emitter
  }

  emitter.close = function (onClose) {
    clearInterval(interval);
    server.close(onClose)
    wsServer.close()
    return emitter
  }

  return emitter
}

