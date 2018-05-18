import QRReader from './vendor/qrscan.js';
import {snackbar} from './snackbar.js';
import styles from '../css/styles.css';
import isURL from 'is-url';
import mqtt from 'mqtt';

//If service worker is installed, show offline usage notification
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    if (!localStorage.getItem("offline")) {
      localStorage.setItem("offline", true);
      snackbar.show('App is ready for offline usage.', 5000);
    }
  });
}

//To generate sw.js file
if (process.env.NODE_ENV === 'production') {
  require('offline-plugin/runtime').install();
}

window.addEventListener("DOMContentLoaded", () => {
  //To check the device and add iOS support
  window.iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

  var timercounter = 0;
  var frame = null;
  var selectPhotoBtn = document.querySelector('.app__select-photos');
  var dialogElement = document.querySelector('.app__dialog');
  var dialogOverlayElement = document.querySelector('.app__dialog-overlay');
  var dialogOpenBtnElement = document.querySelector('.app__dialog-open');
  var dialogCloseBtnElement = document.querySelector('.app__dialog-close');
  var scanningEle = document.querySelector('.custom-scanner');
  var textBoxEle = document.querySelector('#result');
  var helpText = document.querySelector('.app__help-text');
  var infoSvg = document.querySelector('.app__header-icon svg');
  var videoElement = document.querySelector('video');

  var successEle = document.querySelector('.app__dialog-success');
  var authnfailEle = document.querySelector('.app__dialog-authnfail');
  var authzfailEle = document.querySelector('.app__dialog-authzfail');
  var pourtimerEle = document.querySelector('#app__dialog-timer');
  var authnfailmsgEle = document.querySelector('#app__dialog-authnfailmsg');
  var suc_usernameEle = document.querySelector('#app__dialog-suc_username');
  var fail_usernameEle = document.querySelector('#app__dialog-fail_username');
  var authzfailmsgEle = document.querySelector('#app__dialog-authzfailmsg');

  window.appOverlay = document.querySelector('.app__overlay');
  
  //var client  = mqtt.connect('ws://192.168.1.129:9001');
  var client  = mqtt.connect('wss://m11.cloudmqtt.com:36606', {username: "zuwlbkon", password: "51pZqkH1OXLV"});

  client.on('connect', function () {
    console.log('connected to mqtt');
    client.subscribe('/command/scanqr');
    client.subscribe('/status/qrresult');
  });

  client.on('message', function(topic, message) {
    console.log(`topic ${topic}, message ${message}`);
    if(topic.toString() == `/command/scanqr`) {
      if(message.toString() == 'start') {
        scan();
      } else if(message.toString() == 'stop') {
        stopscan();
      }
    } else if(topic.toString() == `/status/qrresult`) {
      /*
      {
        rc: 0, //0:success, 1:authnfail, 2:authzfail
        username: "testuser1",
        pourtime: 60,
        msg: "success"
      }
      */
      var qrr = JSON.parse(message.toString());
      switch(qrr.rc) {
        case 0:
          showDialog(0, qrr.pourtime, qrr.username);
          break;
        case 1:
          showDialog(5000, 0, null, qrr.msg, null);
          break;
        case 2:
        showDialog(5000, 0, qrr.username, null, qrr.msg);
        break;
      }
    }
  });
 
  //Initializing qr scanner
  window.addEventListener('load', (event) => {
    QRReader.init(); //To initialize QR Scanner
    // Set camera overlay size
    setTimeout(() => { 
      setCameraOverlay();
      if (!window.iOS) {
        scan();
      }
    }, 1000);
  });

  function setCameraOverlay() {
    window.appOverlay.style.borderStyle = 'solid';
    helpText.style.display = 'block';
  }

  function removeCameraOverlay() {
    window.appOverlay.style.borderStyle = 'none';
    helpText.style.display = 'none';
  }
  
  function createFrame() {
    frame = document.createElement('img');
    frame.src = '';
    frame.id = 'frame';
  }
  
  function stopscan() {
    removeCameraOverlay();
    scanningEle.style.display = 'none';
    QRReader.stopscan();
  }

  //Scan
  function scan() {
    setCameraOverlay();
    if (!window.iOS) scanningEle.style.display = 'block';
    QRReader.scan((result) => {
      stopscan();
      client.publish('/status/tokenfromqr', result);
    });
  }

  function showTimer(pourtime) { 
    let timercounter = pourtime;
    var x = setInterval(() => {
      pourtimerEle.innerHTML = timercounter;
      timercounter = timercounter - 1;
      if(timercounter < 0) {
        clearInterval(x);
        hideDialog();
      }
    }, 1000);
  }

  function showDialog(period, pourtime=0, username=null, authnfailmsg=null, authzfailmsg=null) {
    dialogElement.classList.remove('app__dialog--hide');
    dialogOverlayElement.classList.remove('app__dialog--hide');
    if(pourtime > 0) {
      // success!
      suc_usernameEle.innerHTML = username;
      successEle.classList.remove('app__dialog--hide');
      showTimer(pourtime);
    } else if(authnfailmsg != null) {
      authnfailEle.classList.remove('app__dialog--hide');
      authnfailmsgEle.innerHTML = authnfailmsg;
    } else if(authzfailmsg != null) {
      authzfailEle.classList.remove('app__dialog--hide');
      authzfailmsgEle.innerHTML = authzfailmsg;
      fail_usernameEle.innerHTML = username;
    }

    if(period > 0) {
      setTimeout(()=>{hideDialog();}, period);
    }
  }

  //Hide dialog
  function hideDialog() {
    dialogElement.classList.add('app__dialog--hide');
    dialogOverlayElement.classList.add('app__dialog--hide');
    successEle.classList.add('app__dialog--hide');
    authnfailEle.classList.add('app__dialog--hide');
    authzfailEle.classList.add('app__dialog--hide');
  }
});
