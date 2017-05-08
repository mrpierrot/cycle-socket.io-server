const xs = require('xstream').default;
const {adapt} = require('@cycle/run/lib/adapt');


function createEventSocketProducer(socket,eventName){
    let eventListener = null;
    return {
        start(listener) {
            eventListener = (data) => {
                listener.next({ name: eventName, data });
            }

            socket.on(eventName, eventListener);
        },
        stop() {
            socket.removeListener(eventName,eventListener)
        }
    }
}

function SocketWrapper(socket) {

    return {
        _original: socket,
        events(eventName) {
            return adapt(xs.create(createEventSocketProducer(socket,eventName)))
        }
    }
}

exports.makeSocketIOServerDriver = function makeSocketIOServerDriver(io) {

    return function socketIOServerDriver(events$) {

        events$.addListener({
            next: outgoing => {
                outgoing.socket._original.emit(outgoing.name,outgoing.data);
            },
            error: () => { },
            complete: () => { },
        });

        function connect() {

            return adapt(xs.create({
                start(listener) {
                    io.on('connection', (socket) => {

                        listener.next(SocketWrapper(socket));
                    });
                },

                stop() {

                }
            }));

        }

        return {
            connect
        }

    }
}