const { assert } = require('chai'),
    _ = require('lodash'),
    xs = require('xstream').default,
    { run } = require('@cycle/run'),
    { adapt } = require('@cycle/run/lib/adapt'),
    { makeSocketIOServerDriver } = require('../src/index');

const serverIO = require('socket.io').listen(5000);
const clientIO = require('socket.io-client');

const socketURL = 'http://localhost:5000';
const options = {
    transports: ['websocket'],
    'force new connection': true
};

const fakeReadDriver = function makeFakeReadDriver(callback, done, count = -1) {
    return function fakeReadDriver(events$) {
        let i = 0;
        const obj = {
            next: outgoing => {
                callback(outgoing, i++,complete);
                if(finish)finish();
            },
            error: () => { },
            complete: () => { },
        }

        let _listener = null;

        const producer = {
            start(listener) {
                _listener = listener;
            },

            stop() {
                _listener = null;
            }
        }

        const complete = () => {
            events$.removeListener(obj);
            if (_listener) {
                _listener.next(true);
            } else {
                console.warn('No listener found for fake driver')
            }
            if(done)done();
        }
  
        const finish = (count > 0)?_.after(count,complete ):null;
        
        events$.addListener(obj);

        return adapt(xs.create(producer))
    }
}

describe('cycle-socket.io-server', function () {

    this.timeout(10000);

    it('connect/disconnect', function (done) {

        // server part

        function main(sources) {
            const { socketServer, fake } = sources;
            const connection$ = socketServer.connect().endWhen(fake);
            const events$ = connection$.map(socket => {
                return xs.merge(
                    xs.of('connect'),
                    socket.events('disconnect').mapTo('disconnect')
                );
            }).flatten();



            const sinks = {
                fake: events$
            };
            return sinks;
        }

        const drivers = {
            socketServer: makeSocketIOServerDriver(serverIO),
            fake: fakeReadDriver((o, i) => {
                if (i == 0) assert.equal(o, 'connect');
                if (i == 1) assert.equal(o, 'disconnect');

            }, done, 2)
        };
        run(main, drivers);

        // client part

        const client = clientIO.connect(socketURL, options);
        client.on('connect', function () {
            client.disconnect();
        });

    });

    it('receive events (event_1, event_2 and disconnect)', function (done) {

        // server part

        function main(sources) {
            const { socketServer, fake } = sources;
            const connection$ = socketServer.connect().endWhen(fake);
            const events$ = connection$.map(socket => {
                const disconnection$ = socket.events('disconnect');
                return xs.merge(
                    socket.events('event_1'),
                    socket.events('event_2'),
                    disconnection$
                );
            }).flatten();
            const sinks = {
                fake: events$
            };
            return sinks;
        }

        const results = [];

        const drivers = {
            socketServer: makeSocketIOServerDriver(serverIO),
            fake: fakeReadDriver((o, i) => {
                results.push(o);
                if (i == 2) {
                    assert.includeDeepMembers(results, [
                        { name: 'event_1', data: 'payload_1' },
                        { name: 'event_2', data: 'payload_2' },
                        { name: 'disconnect', data: 'client namespace disconnect' }
                    ])
                }

            }, done, 3)
        };
        run(main, drivers);

        // client part

        const client = clientIO.connect(socketURL, options);
        client.on('connect', function () {
            client.emit('event_1', 'payload_1');
            _.delay(() => client.emit('event_2', 'payload_2'), 20);
            _.delay(() => client.disconnect(), 300);
        });

    });


    it('send events ping/pang ( pong dont work! )', function (done) {

        // server part

        function main(sources) {
            const { socketServer, fake } = sources;
            const connection$ = socketServer.connect().endWhen(fake);
            const events$ = connection$.map(socket => {
                const disconnection$ = socket.events('disconnect');
                return xs.merge(
                    socket.events('pang'),
                    disconnection$
                );
            }).flatten();

            const ping$ = xs.combine(xs.periodic(100), connection$).map(
                ([timer, socket]) => {
                    return {
                        socket: socket,
                        name: 'ping'
                    }
                }
            );

            const sinks = {
                socketServer: ping$,
                fake: events$
            };
            return sinks;
        }

        const results = [];

        const drivers = {
            socketServer: makeSocketIOServerDriver(serverIO),
            fake: fakeReadDriver((o, i,complete) => {
                if(o.name == 'disconnect'){
                    assert.isAbove(results.length,2);
                    complete();
                }else{
                    results.push(o);
                }

            }, done)
        };
        run(main, drivers);

        // client part

        const client = clientIO.connect(socketURL, options);
        client.on('connect', function () {
            client.on('ping',() => {
                client.emit('pang');
            });
            _.delay(() => client.disconnect(), 1000);
        });

    });
});