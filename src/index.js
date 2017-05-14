const xs = require('xstream').default;
const { adapt } = require('@cycle/run/lib/adapt');


function createSocketEventProducer(socket, eventName) {
    let eventListener = null;
    return {
        start(listener) {
            eventListener = (data) => {
                listener.next({ name: eventName, data });
            }

            socket.on(eventName, eventListener);
        },
        stop() {
            socket.removeListener(eventName, eventListener)
        }
    }
}

function createServerEventProducer(io, eventName) {
    let eventListener = null;
    return {
        start(listener) {
            eventListener = (socket) => {
                listener.next(SocketWrapper(socket));
            }
            io.on(eventName, eventListener);
        },

        stop() {
            io.removeListener(eventName, eventListener)
        }
    }
}

function SocketWrapper(socket) {

    return {
        _original: socket,
        events(eventName) {
            return adapt(xs.create(createSocketEventProducer(socket, eventName)))
        }
    }
}

exports.makeSocketIOServerDriver = function makeSocketIOServerDriver(io) {

    return function socketIOServerDriver(events$) {

        events$.addListener({
            next: outgoing => {
                if(outgoing.socket){
                     outgoing.socket._original.emit(outgoing.name, outgoing.data);
                }else{
                    io.emit(outgoing.name, outgoing.data);
                }
               
            },
            error: () => { },
            complete: () => { },
        });

        function connect() {
            return adapt(xs.create(createServerEventProducer(io, 'connection')));
        }

        return {
            connect
        }

    }
}