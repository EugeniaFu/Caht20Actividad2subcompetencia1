console.log('Hola soy el script y me cargue correctamente');

var mapPeers = {};

var labelUsername = document.querySelector('#label-username');
var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');

var username;

var webSocket;

function webSocketOnMessage(event) {
    var parseData = JSON.parse(event.data);
    var peerUsername = parseData['peer'];
    var action = parseData['action'];

    if (username == peerUsername) {
        return;
    }

    var receiver_channel_name = parseData['message']['receiver_channel_name']

    if(action == 'new-peer'){
        createOfferer(peerUsername, receiver_channel_name);

        return;
    }

    if(action == 'new-offer'){
        var offer = parseData['message']['sdp'];

        createAnswerer(offer, peerUsername, receiver_channel_name);

        return;
    }

    if(action == 'new-answer'){
        var answer = parseData['message']['sdp']

        var peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);

        return;
    }

    //console.log('message:', message);
    webSocket.addEventListener('message', (event) => {
        console.log('Mensaje recibido del WebSocket:', event.data);
        webSocketOnMessage(event);
    });
    
}

btnJoin.addEventListener('click', () => {
    username = usernameInput.value;
    console.log('username:', username);
  
    if (username == '') {
       return;
    }

    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';

    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    var labelUsername = document.querySelector('#label-username');
    labelUsername.innerHTML = username;

    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol == 'https:') {
        wsStart = 'wss://';
    }

    // Asegúrate de definir correctamente el room_slug (por ejemplo, podría ser un valor dinámico)
    var roomSlug = 'my-room';  // Cambia esto por el valor real del room_slug

    // Construir la URL correcta con room_slug
    var wsStart = window.location.protocol === "https:" ? "wss://" : "ws://";
    var roomSlug = "my-room";  // Nombre de la sala
    var endPoint = wsStart + "ab62-187-184-159-44.ngrok-free.app/ws/" + roomSlug + "/";


    console.log('endPoint:', endPoint);

    webSocket = new WebSocket(endPoint);

    webSocket.addEventListener('open', (e) => {
        console.log('Connection Opened!!');
        sendSignal('new-peer', {});
    });
    webSocket.addEventListener('message', webSocketOnMessage);
    webSocket.addEventListener('close', (e) => {
        console.log('Connection Closed!!');
    });
    webSocket.addEventListener('error', (e) => {
        console.log('Error Ocurred!!');
    });
});


var localStream = new MediaStream();

const constraints = {
    'video' : true,
    'audio' : true
}

const localVideo = document.querySelector('#local-video');

const btnToggleAudio = document.querySelector('#btn-toggle-audio');

const btnToggleVideo = document.querySelector('#btn-toggle-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream =>{
         localStream = stream;
         localVideo.srcObject = localStream;
         localVideo.muted = true;

         var audioTracks = stream.getAudioTracks();
         var videoTracks = stream.getVideoTracks();

         audioTracks[0].enabled = true;
         videoTracks[0].enabled = true;

         btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if(audioTracks[0].enabled){
                btnToggleAudio.innerHTML = 'Audio mute';

                return;
            }
            btnToggleAudio.innerHTML = 'Audio unmute';
         });

         btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if(videoTracks[0].enabled){
                btnToggleVideo.innerHTML = 'Video apagado';

                return;
            }
            btnToggleVideo.innerHTML = 'Video activado';
         });
    })
    .catch(error => {
       console.log('Error al acceder a los medios', error);
    });

    var btnSendMsg = document.querySelector('#btn-send-msg');
    var messageList = document.querySelector('#message-list');
    var messageInput = document.querySelector("#msg");
    btnSendMsg.addEventListener('click', sendMsgOnClick);

    function sendMsgOnClick(){
      var message = messageInput.value;

      var li = document.createElement('li');
      li.appendChild(document.createTextNode('Me:' + message));
      messageList.appendChild(li);

      message = username + ': ' + message;

      var dataChannels = getDataChannels(); // Llamar la función correctamente

      for (var index in dataChannels) {
          dataChannels[index].send(message);
      }
      
      messageInput.value = '';
    }

    function sendSignal(action, message){
        var jsonStr = JSON.stringify({
            'peer' : username,
            'action': action,
            'message': message,
        });
    
        webSocket.send(jsonStr);
    }

    function createOfferer(peerUsername, receiver_channel_name){
        var peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        });

        addLocalTracks(peer);

        var dc = peer.createDataChannel('channel');
        dc.addEventListener('open', () => {
             console.log('Conexión abierta!!');
        });
        dc.addEventListener('message', dcOnMessage);

        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);

        mapPeers[peerUsername] = [peer, dc];

        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === 'failed' || iceConnectionState === 'disconected' ||iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo);
            }
        });

        peer.addEventListener('icecandidate', (event) => {
            if(event.candidate){
                console.log('Nuevo ice candidate', JSON.stringify(peer.localDescription));

                return;
            }

            sendSignal('new-offer', {
               'sdp': peer.localDescription,
               'receiver_channel_name': receiver_channel_name
            });
        });

        peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log('Local description successfully.');
        });
    }

    function createAnswerer(offer, peerUsername, receiver_channel_name){
        var peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        });

        addLocalTracks(peer);

        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);

        peer.addEventListener('datachannel', e => {
            peer.dc = e.channel;
            peer.dc.addEventListener('open', () => {
                console.log('Conexión abierta!!');
           });
           peer.dc.addEventListener('message', dcOnMessage);

           mapPeers[peerUsername] = [peer, peer.dc];
        });

        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === 'failed' || iceConnectionState === 'disconected' ||iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo);
            }
        });

        peer.addEventListener('icecandidate', (event) => {
            if(event.candidate){
                console.log('Nuevo ice candidate', JSON.stringify(peer.localDescription));

                return;
            }

            sendSignal('new-answer', {
               'sdp': peer.localDescription,
               'receiver_channel_name': receiver_channel_name
            });
        });

        /*peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log('Local description successfully.');
        });*/

        peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Remote description set for', peerUsername);
            return peer.createAnswer();
        })
        .then(a => {
            console.log('Answer created for', peerUsername);
            return peer.setLocalDescription(a);
        })
        .then(() => {
            console.log('Local description set for', peerUsername);
        });
    
    }

    function addLocalTracks(peer){
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });

        return;
    }

    
    function dcOnMessage(event){
         var message = event.data;

         var li = document.createElement('li');
         li.appendChild(document.createTextNode(message));
         messageList.appendChild(li);
    }

    function createVideo(peerUsername){
        var videoContainer = document.querySelector('#video-container');
    
        var videoWrapper = document.createElement('div');
        videoWrapper.id = peerUsername + '-wrapper';
    
        var remoteVideo = document.createElement('video'); // Aquí creamos un nuevo elemento video
        remoteVideo.id = peerUsername + '-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
    
        videoWrapper.appendChild(remoteVideo);
        videoContainer.appendChild(videoWrapper);
    
        return remoteVideo;
    }    

    function setOnTrack(peer, remoteVideo) {
        var remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
    
        peer.addEventListener('track', async (event) => {
            remoteStream.addTrack(event.track); // Solo `event.track`
        });
    }    

    function removeVideo(video) {
        if (video) {
            var videoWrapper = document.getElementById(video.id + '-wrapper');
            if (videoWrapper) {
                videoWrapper.remove();
            }
        }
    }
    
    function getDataChannels(){
        var dataChannels = [];

        for(peerUsername in mapPeers){
            var dataChannel = mapPeers[peerUsername][1];

            dataChannels.push(dataChannel);
        }

        return dataChannels;
    }

    document.querySelector("#btn-share-end").addEventListener("click", () => {
        console.log("Saliendo de la llamada...");
    
        // Cerrar la conexión WebSocket
        if (webSocket) {
            webSocket.close();
        }
    
        // Detener la transmisión de la cámara y el micrófono
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    
        // Cerrar todas las conexiones WebRTC
        for (let peerUsername in mapPeers) {
            let peerConnection = mapPeers[peerUsername][0]; // Obtener la conexión PeerConnection
            peerConnection.close();
        }
    
        // Limpiar el objeto de peers
        mapPeers = {};
    
        // Eliminar los elementos de video de la interfaz
        document.querySelector("#video-container").innerHTML = "";
    
        // Opcional: Redirigir a otra página o mostrar un mensaje
        alert("Has salido de la llamada.");
    });
    