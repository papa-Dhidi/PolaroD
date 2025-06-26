const video = document.getElementById('video');
const frameSelect = document.getElementById('frameSelect');
const framePreview = document.getElementById('framePreview');
const hatOverlay = document.getElementById('hatOverlay'); // elemen gambar topi overlay
const useFilter = document.getElementById('useFilter');   // ✅ checkbox filter
const hat = new Image();
hat.src = '/static/filters/hat.png';

let latestDetection = null;

// INISIALISASI MEDIAPIPE
const faceDetection = new FaceDetection({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
});
faceDetection.setOptions({
  model: 'short',
  minDetectionConfidence: 0.5
});

// DETEKSI WAJAH DAN ATUR POSISI TOPI (overlay)
faceDetection.onResults(results => {
  if (results.detections.length > 0 && useFilter.checked) { // ✅ hanya jika dicentang
    latestDetection = results.detections[0];
    const box = latestDetection.boundingBox;

    const vw = video.offsetWidth;
    const vh = video.offsetHeight;

    const x = box.xCenter * vw - (box.width * vw / 2);
    const y = box.yCenter * vh - (box.height * vh * 1.1);
    const width = box.width * vw;
    const height = box.height * vh * 0.7;

    Object.assign(hatOverlay.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      display: 'block'
    });
  } else {
    latestDetection = null;
    hatOverlay.style.display = 'none';
  }
});

// JALANKAN KAMERA
const camera = new Camera(video, {
  onFrame: async () => {
    await faceDetection.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();

// FALLBACK GETUSERMEDIA
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
    video.play();
  })
  .catch(error => {
    alert("Gagal mengakses kamera: " + error);
  });

// PREVIEW FRAME
frameSelect.addEventListener('change', () => {
  framePreview.src = `/static/frames/${frameSelect.value}`;
});

// AMBIL FOTO
async function takePhoto() {
  const targetWidth = 1080;
  const targetHeight = 1440;
  const targetRatio = targetWidth / targetHeight;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = targetWidth;
  offCanvas.height = targetHeight;
  const offCtx = offCanvas.getContext('2d');

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const videoRatio = videoWidth / videoHeight;

  let sx, sy, sw, sh;
  if (videoRatio > targetRatio) {
    sh = videoHeight;
    sw = sh * targetRatio;
    sx = (videoWidth - sw) / 2;
    sy = 0;
  } else {
    sw = videoWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = (videoHeight - sh) / 2;
  }

  offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  // Tambahkan topi ke hasil foto jika filter aktif
  if (latestDetection && useFilter.checked) {
    const box = latestDetection.boundingBox;
    const x = box.xCenter * targetWidth - (box.width * targetWidth / 2);
    const y = box.yCenter * targetHeight - (box.height * targetHeight * 1.1);
    const width = box.width * targetWidth;
    const height = box.height * targetHeight * 0.7;

    offCtx.drawImage(hat, x, y, width, height);
  }

  const dataURL = offCanvas.toDataURL('image/png');

  fetch('/save-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: dataURL,
      frame: frameSelect.value,
      filters: []
    })
  })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'photobooth.png';
      link.click();
    });
}

// UI FUNCTION
function toggleMenu() {
  document.getElementById('menu').classList.toggle('active');
}
function toggleFullScreen(checkFullScreen) {
  const heading = document.getElementById('idf1');
  heading.style.width = checkFullScreen.checked ? '100%' : '37vh';
}
function toggleFrameSelect() {
  document.getElementById("side-frame").classList.toggle("active");
}
