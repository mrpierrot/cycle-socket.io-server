# cycle-socket.io-server

cycle-socket.io-server is a [socket.io](https://socket.io/) server driver for [cycle.js](https://cycle.js.org/)

## Installation 

`npm i cycle-socket.io-server --save`

## Import 

```javascript
    const { makeSocketIOServerDriver } = require('cycle-socket.io-server');
```

## Use

### Create the driver : `makeSocketIOServerDriver(io)`

With `io` the socket.io instance

```javascript
    const drivers = {
        // create a socket.io server driver instance
        socketServer:makeSocketIOServerDriver(io)
    };

``` 

### Get users connections with `socketServer.connect()`

Return the stream of users connections

```javascript

    function main(sources) {
        const { socketServer } = sources;
        
        // get user connection stream ( A sockets stream )
        const connection$ = socketServer.connect();
        
        // socket is a socket.io socket wrapper
        const events$ = connection$.map( socket => {
    
        })
    }

```

### Socket wrapper API

Currently, the socket has only one function.

#### Listener socket events with `socket.events()`

Return a stream a events objects `{name:<string>, data:*}` emit by the socket.

```javascript
      const events$ = connection$.map( socket => {
          // get disconnect stream
          const disconnection$ = socket.events('disconnect');
          return xs.merge(
              // get event_01 stream
              socket.events('event_01'),
              // get event_01 stream
              socket.events('event_02')
          );
      }).flatten();
```

### Send a socket event

Send stream of object on the sink `socketServer`


#### The object definition

```javascript
   {
        socket:socket, // the target socket
        name:'ping', // the event name:<string>
        data: 'pong' // the event data
    }
```

#### A ping example
```javascript

  // send a ping message to a specific soket every second.
  const ping$ = xs.combine(xs.periodic(1000),connection$).map(
      ([timer,socket]) => {
          return {
              socket:socket,
              name:'ping',
              data: 'pong'
          }
      }
  );

  const sinks = {
       socketServer: ping$,
  };
```

### A full example

```javascript
    const xs = require('xstream').default,
    { run } = require('@cycle/run'),
    { makeSocketIOServerDriver } = require('cycle-socket.io-server');

    const io = require('socket.io').listen(5000);

    function main(sources) {

        const { socketServer } = sources;

        // get user connection stream
        const connection$ = socketServer.connect();
        
        const events$ = connection$.map( socket => {
            // get disconnect stream
            const disconnection$ = socket.events('disconnect');
            return xs.merge(
                // get event_01 stream
                socket.events('event_01'),
                // get event_01 stream
                socket.events('event_02')
            ).endWhen(disconnection$);
        }).flatten();

        // send a ping message to a specific soket every second.
        const ping$ = xs.combine(xs.periodic(1000),connection$).map(
            ([timer,socket]) => {
                return {
                    socket:socket,
                    name:'ping',
                    data: 'pong'
                }
            }
        );
        
        const sinks = {
            socketServer: ping$,
            fake: events$
        };
        return sinks;
    }

    const drivers = {
        // create a socket.io server driver instance
        socketServer:makeSocketIOServerDriver(io),
        // a fake driver who listen socket events stream
        fake:makeFakeDriver()
    };

    run(main, drivers);
}
```

## License

[Beerware](https://github.com/mrpierrot/cycle-socket.io-server/blob/master/LICENSE)
