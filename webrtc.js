function _assert(desc, v) {
    if (v) {
        return;
    } else {
        let caller = _assert.caller || 'Top level';
        console.error('ASSERT in %s, %s is :', caller, desc, v);
    }
}

//-- GUI関連
let container = document.getElementById('video_container');
_assert('video_container', container);
var urlParams = new URLSearchParams(location.search);
var connKeyword = null;
if (urlParams.has('room') && typeof Cookies.get('keyword') != 'undefined') {
    connKeyword = Cookies.get('keyword');
    console.log('Room Name: ' + urlParams.get('room'));
    document.getElementById('keyword').value = Cookies.get('keyword');
    $('#tabs #tabTarget').tab('show');
} else {
    console.log('No Room Name');
    document.getElementById('tabTarget').classList.add('disabled');
    $('#tabs #tabCtrl').tab('show');
}
$('#formRoom').submit(function() {
    Cookies.set('keyword', document.getElementById('keyword').value);
});

//ビデオON/OFFスイッチ
$('#ctrlVideo').change(function() {
    if ($(this).prop('checked')) {
        $('#ctrlConnect').bootstrapToggle('enable');
        startVideo();
        console.log('startVideo');
    } else {
        $('#ctrlConnect').bootstrapToggle('off')
        $('#ctrlConnect').bootstrapToggle('disable');
        stopVideo();
        console.log('stopVideo');
    }
});

//接続／切断スイッチ
$('#ctrlConnect').change(function() {
    if ($(this).prop('checked')) {
        connect();
        console.log('connect');
    } else {
        hangUp();
        console.log('hangUp');
    }
});

//-- VIDEO関連
let localVideo = document.getElementById('local_video'); //video idとして保存したもの
//let remoteVideo = document.getElementById('remote_video');
let localStream = null; //流す奴
//let peerConnection = null;
//let textForSendSdp = document.getElementById('text_for_send_sdp');
//let textToReceiveSdp = document.getElementById('text_for_receive_sdp');
// ---- for multi party -----
let peerConnections = [];
//let remoteStreams = [];
let remoteVideos = [];
const MAX_CONNECTION_COUNT = 3;
// --- multi video ---
//let container = document.getElementById('target');
//_assert('target', container);
// --- prefix -----
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate || window.msRTCIceCandidate;

// ----- use socket.io ---
const port = 10443;
const socket = io.connect('https://sakura.yokoyama.ac:10443', {
    secure: true
});
let room = getRoomName();
socket.on('connect', function(evt) { //部屋に入ったとき
    console.log('socket.io connected. enter room=' + room);
    socket.emit('enter', room);
});
socket.on('message', function(message) {
    console.log('message:', message);
    let fromId = message.from;

    if (message.type === 'offer') {
        // -- got offer ---
        console.log('Received offer ...');
        let offer = new RTCSessionDescription(message);
        setOffer(fromId, offer);
    } else if (message.type === 'answer') {
        // --- got answer ---
        console.log('Received answer ...');
        let answer = new RTCSessionDescription(message);
        setAnswer(fromId, answer);
    } else if (message.type === 'candidate') {
        // --- got ICE candidate ---ICECandidate（通信経路）を扱う
        console.log('Received ICE candidate ...');
        let candidate = new RTCIceCandidate(message.ice);
        console.log(candidate);
        addIceCandidate(fromId, candidate);
    } else if (message.type === 'call me') { //peer同士をつなげるとき
        if (!isReadyToConnect()) {
            console.log('Not ready to connect, so ignore');
            return;
        } else if (!canConnectMore()) {
            console.warn('TOO MANY connections, so ignore');
        }

        if (isConnectedWith(fromId)) {
            // already connnected, so skip
            console.log('already connected, so ignore');
        } else {
            // connect new party
            makeOffer(fromId);
        }
    } else if (message.type === 'bye') { //切るとき
        if (isConnectedWith(fromId)) {
            stopConnection(fromId);
        }
    }
});
socket.on('user disconnected', function(evt) { //通信を切るとき
    console.log('====user disconnected==== evt:', evt);
    let id = evt.id;
    if (isConnectedWith(id)) {
        stopConnection(id);
    }
});

// --- broadcast message to all members in room
function emitRoom(msg) {
    socket.emit('message', msg); //SDPの送信
}

function emitTo(id, msg) {
    msg.sendto = id;
    socket.emit('message', msg);
}

// -- room名を取得 --
function getRoomName() {
    //こっちがモダンなやり方
    // たとえば、 URLに  ?room=roomname  とする
    var urlParams = new URLSearchParams(location.search);
    if (urlParams.has('room')) {
        return urlParams.get('room');
    } else {
        return '_testroom';
    }

    /*
    // たとえば、 URLに  ?roomname  とする
    let url = document.location.href;
    let args = url.split('?');
    if (args.length > 1) {
        let room = args[1];
        if (room != '') {
            return room;
        }
    }
    return '_testroom'; //何も入力されないときはroom名＝_testroom
    */
}

// ---- for multi party -----
function isReadyToConnect() {
    if (localStream) {
        return true;
    } else {
        return false;
    }
}

// --- RTCPeerConnections ---
function getConnectionCount() {
    return peerConnections.length;
}

function canConnectMore() {
    return (getConnectionCount() < MAX_CONNECTION_COUNT);
}

function isConnectedWith(id) {
    if (peerConnections[id]) {
        return true;
    } else {
        return false;
    }
}

function addConnection(id, peer) {
    _assert('addConnection() peer', peer);
    _assert('addConnection() peer must NOT EXIST', (!peerConnections[id]));
    peerConnections[id] = peer;
}

function getConnection(id) {
    let peer = peerConnections[id];
    _assert('getConnection() peer must exist', peer);
    return peer;
}

function deleteConnection(id) {
    _assert('deleteConnection() peer must exist', peerConnections[id]);
    delete peerConnections[id];
}

function stopConnection(id) {
    detachVideo(id);

    if (isConnectedWith(id)) {
        let peer = getConnection(id);
        peer.close();
        deleteConnection(id);
    }
}

function stopAllConnection() {
    for (let id in peerConnections) {
        stopConnection(id);
    }
}

// --- video elements ---
function attachVideo(id, stream) { //video流し隊
    let video = addRemoteVideoElement(id);
    playVideo(video, stream);
    video.volume = 1.0;
}

function detachVideo(id) { //video流しの止める隊
    let video = getRemoteVideoElement(id);
    pauseVideo(video);
    deleteRemoteVideoElement(id);
}

function isRemoteVideoAttached(id) { //
    if (remoteVideos[id]) {
        return true;
    } else {
        return false;
    }
}

function addRemoteVideoElement(id) { //外部video_id登録
    _assert('addRemoteVideoElement() video must NOT EXIST', (!remoteVideos[id]));
    let video = createVideoElement('remote_video_' + id); //L253
    remoteVideos[id] = video;
    return video;
}

function getRemoteVideoElement(id) { //外部video_id取得
    let video = remoteVideos[id];
    _assert('getRemoteVideoElement() video must exist', video);
    return video;
}

function deleteRemoteVideoElement(id) { //外部video_id削除
    _assert('deleteRemoteVideoElement() stream must exist', remoteVideos[id]);
    removeVideoElement('remote_video_' + id);
    delete remoteVideos[id];
}

function createVideoElement(elementId) { //ビデオ要素（枠の色とか大きさとか）
    let video = document.createElement('video');
    //video.width = '800';
    //video.height = '600';
    video.id = elementId;
    video.setAttribute('class', 'col');

    //video.style.border = 'solid black 1px';
    //video.style.margin = '2px';

    container.appendChild(video);

    return video;
}

function removeVideoElement(elementId) { //ビデオ要素削除→これないと枠だけ残る可能性がある
    let video = document.getElementById(elementId);
    _assert('removeVideoElement() video must exist', video);

    container.removeChild(video);
    return video;
}

// ---------------------- media handling ----------------------- 
function startVideo() { // ボタンを押して自分のWebカメラの映像を映す
    getDeviceStream({
            video: true,
            audio: true
        }) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
        .then(function(stream) { // success
            localStream = stream;
            playVideo(localVideo, stream);
        }).catch(function(error) { // error
            console.error('getUserMedia error:', error);
            return;
        });
}

function stopVideo() { // stop local video
    pauseVideo(localVideo);
    stopLocalStream(localStream);
    localStream = null;
}

function stopLocalStream(stream) { // 映像を取得することをやめる
    let tracks = stream.getTracks();
    if (!tracks) {
        console.warn('NO tracks');
        return;
    }

    for (let track of tracks) {
        track.stop();
    }
}

function getDeviceStream(option) { //Webカメラの映像を取得
    if ('getUserMedia' in navigator.mediaDevices) {
        console.log('navigator.mediaDevices.getUserMadia');
        return navigator.mediaDevices.getUserMedia(option);
    } else {
        console.log('wrap navigator.getUserMadia with Promise');
        return new Promise(function(resolve, reject) {
            navigator.getUserMedia(option,
                resolve,
                reject
            );
        });
    }
}

function playVideo(element, stream) { // videoタグにstreamを映す
    if ('srcObject' in element) {
        element.srcObject = stream;
    } else {
        element.src = window.URL.createObjectURL(stream);
    }
    element.play();
    element.volume = 0;
}

function pauseVideo(element) {
    element.pause();
    if ('srcObject' in element) {
        element.srcObject = null;
    } else {
        if (element.src && (element.src !== '')) {
            window.URL.revokeObjectURL(element.src);
        }
        element.src = '';
    }
}

function sendSdp(id, sessionDescription) {
    console.log('---sending sdp ---');
    let message = {
        type: sessionDescription.type,
        sdp: sessionDescription.sdp
    };
    console.log('sending SDP=' + message);
    //ws.send(message);
    emitTo(id, message);
}

function sendIceCandidate(id, candidate) {
    console.log('---sending ICE candidate ---');
    let obj = {
        type: 'candidate',
        ice: candidate
    };
    if (isConnectedWith(id)) {
        emitTo(id, obj);
    } else {
        console.warn('connection NOT EXIST or ALREADY CLOSED. so skip candidate')
    }
}
// ---------------------- connection handling -----------------------
function prepareNewConnection(id) { //SDPを交換したのちpeerとして相手を認識し、ICECandidateを送りまくる
    let pc_config = {
        "iceServers": [ //　STUN/TURNサーバについて
            {
                "urls": "stun:sakura.yokoyama.ac:5349"
            }, {
                "urls": "stun:sakura.yokoyama.ac:3478"
            }, {
                "urls": "turn:sakura.yokoyama.ac:5349?transport=udp",
                "username": "tmustudents2020",
                "credential": connKeyword
            },

            {
                "urls": "turn:sakura.yokoyama.ac:3478?transport=udp",
                "username": "tmustudents2020",
                "credential": connKeyword
            },

            {
                "urls": "turn:sakura.yokoyama.ac:3478?transport=tcp",
                "username": "tmustudents2020",
                "credential": connKeyword
            },

            {
                "urls": "turn:sakura.yokoyama.ac:5349?transport=tcp",
                "username": "tmustudents2020",
                "credential": connKeyword
            }
        ]
    };

    let peer = new RTCPeerConnection(pc_config);

    // --- on get remote stream ---
    if ('ontrack' in peer) {
        peer.ontrack = function(event) {
            let stream = event.streams[0];
            console.log('-- peer.ontrack() stream.id=' + stream.id);
            if (isRemoteVideoAttached(id)) {
                console.log('stream already attached, so ignore');
            } else {
                //playVideo(remoteVideo, stream);
                attachVideo(id, stream);
            }
        };
    } else { //offtrack
        peer.onaddstream = function(event) {
            let stream = event.stream;
            console.log('-- peer.onaddstream() stream.id=' + stream.id);
            //playVideo(remoteVideo, stream);
            attachVideo(id, stream);
        };
    }
    // --- on get local ICE candidate
    peer.onicecandidate = function(evt) {
        if (evt.candidate) {
            console.log(evt.candidate);
            // Trickle ICE の場合は、ICE candidateを相手に送る
            sendIceCandidate(id, evt.candidate);
            // Vanilla ICE の場合には、何もしない
        } else {
            console.log('empty ice event');
            // Trickle ICE の場合は、何もしない
            // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
            //sendSdp(id, peer.localDescription);
        }
    };
    // --- when need to exchange SDP ---
    peer.onnegotiationneeded = function(evt) {
        console.log('-- onnegotiationneeded() ---');
    };
    // --- other events ----
    peer.onicecandidateerror = function(evt) {
        console.error('ICE candidate ERROR:', evt);
    };
    peer.onsignalingstatechange = function() {
        console.log('== signaling status=' + peer.signalingState);
    };
    peer.oniceconnectionstatechange = function() {
        console.log('== ice connection status=' + peer.iceConnectionState);
        if (peer.iceConnectionState === 'disconnected') {
            console.log('-- disconnected --');
            //hangUp();
            stopConnection(id);
        }
    };

    peer.onicegatheringstatechange = function() {
        console.log('==***== ice gathering state=' + peer.iceGatheringState);
    };

    peer.onconnectionstatechange = function() {
        console.log('==***== connection state=' + peer.connectionState);
    };

    peer.onremovestream = function(event) {
        console.log('-- peer.onremovestream()');
        //pauseVideo(remoteVideo);
        deleteRemoteStream(id);
        detachVideo(id);
    };


    // -- add local stream --// Offer/Answerのセット終了後addすることでonicecandidateが発火
    if (localStream) {
        console.log('Adding local stream...');
        peer.addStream(localStream);
    } else {
        console.warn('no local stream, but continue.');
    }
    return peer;
}
//ここがwebRTCをするための仕組みの真髄
function makeOffer(id) {
    _assert('makeOffer must not connected yet', (!isConnectedWith(id)));
    peerConnection = prepareNewConnection(id);
    addConnection(id, peerConnection); //id登録
    peerConnection.createOffer()
        .then(function(sessionDescription) {
            console.log('createOffer() succsess in promise');
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() {
            console.log('setLocalDescription() succsess in promise');
            // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
            sendSdp(id, peerConnection.localDescription);
            // -- Vanilla ICE の場合には、まだSDPは送らない --
        }).catch(function(err) {
            console.error(err);
        });
}

function setOffer(id, sessionDescription) {
    /*
    if (peerConnection) {
      console.error('peerConnection alreay exist!');
    }
    */
    _assert('setOffer must not connected yet', (!isConnectedWith(id)));
    let peerConnection = prepareNewConnection(id);
    addConnection(id, peerConnection);
    peerConnection.setRemoteDescription(sessionDescription)
        .then(function() {
            console.log('setRemoteDescription(offer) succsess in promise');
            makeAnswer(id);
        }).catch(function(err) {
            console.error('setRemoteDescription(offer) ERROR: ', err);
        });
}

function makeAnswer(id) {
    console.log('sending Answer. Creating remote session description...');
    let peerConnection = getConnection(id);
    if (!peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.createAnswer()
        .then(function(sessionDescription) {
            console.log('createAnswer() succsess in promise');
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() {
            console.log('setLocalDescription() succsess in promise');
            // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
            sendSdp(id, peerConnection.localDescription);
            // -- Vanilla ICE の場合には、まだSDPは送らない --
        }).catch(function(err) {
            console.error(err);
        });
}

function setAnswer(id, sessionDescription) {
    let peerConnection = getConnection(id);
    if (!peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
    }
    peerConnection.setRemoteDescription(sessionDescription)
        .then(function() {
            console.log('setRemoteDescription(answer) succsess in promise');
        }).catch(function(err) {
            console.error('setRemoteDescription(answer) ERROR: ', err);
        });
}


// --- tricke ICE ---
function addIceCandidate(id, candidate) {
    if (!isConnectedWith(id)) {
        console.warn('NOT CONNEDTED or ALREADY CLOSED with id=' + id + ', so ignore candidate');
        return;
    }
    let peerConnection = getConnection(id);
    if (peerConnection) {
        peerConnection.addIceCandidate(candidate);
    } else {
        console.error('PeerConnection not exist!');
        return;
    }
}
// start PeerConnection
function connect() {
    /*
    debugger; // SHOULD NOT COME HERE
    if (! peerConnection) {
      console.log('make Offer');
      makeOffer();
    }
    else {
      console.warn('peer already exist.');
    }
    */
    if (!isReadyToConnect()) {
        console.warn('NOT READY to connect');
    } else if (!canConnectMore()) {
        console.log('TOO MANY connections');
    } else {
        callMe();
    }
}
// close PeerConnection
function hangUp() {
    /*
    if (peerConnection) {
      console.log('Hang up.');
      peerConnection.close();
      peerConnection = null;
      pauseVideo(remoteVideo);
    }
    else {
      console.warn('peer NOT exist.');
    }
    */
    emitRoom({
        type: 'bye'
    });
    stopAllConnection();
}
// ---- multi party --
function callMe() {
    emitRoom({
        type: 'call me'
    });
}
