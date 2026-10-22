(() => {
  // 1. DOM Elements
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('overlayCanvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('cameraPlaceholder');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const notice = document.getElementById('notice');
  const liveBadge = document.getElementById('liveBadge');
  const liveText = document.getElementById('liveText');
  const badgeDot = document.getElementById('badgeDot');
  const stageMode = document.getElementById('stageMode');
  const stageTech = document.getElementById('stageTech');
  const detectedCount = document.getElementById('detectedCount');
  const countLabel = document.getElementById('countLabel');
  const fpsDisplay = document.getElementById('fpsValue');
  const modelStatus = document.getElementById('modelStatus');

  const modeRadios = document.querySelectorAll('input[name="aiMode"]');

  // 2. State Variables
  let stream = null;
  let faceDetector = null;
  let objectDetector = null;
  let currentMode = 'face'; // 'face' hoặc 'object'
  let animationFrameId = null;
  let isRunning = false;

  // Đo FPS
  let lastFrameTime = performance.now();
  let frameCount = 0;

  function setStatus(message, state = 'normal') {
    statusText.textContent = message;
    statusDot.className = 'status-icon';
    if (state === 'ready') statusDot.classList.add('ready');
    if (state === 'loading') statusDot.classList.add('loading');
  }

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.style.display = 'block';
    notice.style.background = isError ? '#ffe8e8' : '#e9f4ed';
    notice.style.color = isError ? '#a82424' : '#20543e';
  }

  function hideNotice() {
    notice.textContent = '';
    notice.style.display = 'none';
  }

  // 3. Tải Model theo chế độ
  async function ensureModelLoaded(mode) {
    await tf.setBackend('webgl');
    await tf.ready();

    if (mode === 'face') {
      if (!faceDetector) {
        setStatus('Đang tải mô hình Face Detection (MediaPipe)...', 'loading');
        modelStatus.textContent = 'Đang nạp Face...';
        faceDetector = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          { runtime: 'tfjs', modelType: 'short' }
        );
      }
      modelStatus.textContent = 'MediaPipe Face';
      stageTech.textContent = 'FACE DETECTOR / WEBGL';
      countLabel.textContent = 'Khuôn mặt';
      return faceDetector;
    } else {
      if (!objectDetector) {
        setStatus('Đang tải mô hình Object Recognition (COCO-SSD)...', 'loading');
        modelStatus.textContent = 'Đang nạp COCO...';
        objectDetector = await cocoSsd.load();
      }
      modelStatus.textContent = 'COCO-SSD (80 Objects)';
      stageTech.textContent = 'OBJECT RECOGNITION';
      countLabel.textContent = 'Vật thể';
      return objectDetector;
    }
  }

  // Lắng nghe sự kiện đổi chế độ
  modeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      currentMode = e.target.value;
      if (isRunning) {
        setStatus(`Đang chuyển sang chế độ ${currentMode === 'face' ? 'Khuôn mặt' : 'Nhận diện Vật thể'}...`, 'loading');
        await ensureModelLoaded(currentMode);
        setStatus('Đang nhận diện liên tục trên WebGL.', 'ready');
      }
    });
  });

  // 4. Vẽ kết quả Face Detection
  function drawFaces(faces) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    detectedCount.textContent = faces.length;

    faces.forEach(face => {
      const box = face.box;
      const score = Math.round((face.score || 0) * 100);

      // Bounding box
      ctx.strokeStyle = '#38d976';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);

      // Nhãn
      const labelText = `Face: ${score}%`;
      ctx.font = '600 13px Manrope, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillStyle = 'rgba(23, 34, 29, 0.85)';
      ctx.fillRect(box.xMin, Math.max(0, box.yMin - 24), textWidth + 14, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, box.xMin + 7, Math.max(16, box.yMin - 8));

      // Keypoints
      if (face.keypoints) {
        face.keypoints.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffdf5d';
          ctx.fill();
        });
      }
    });
  }

  // 5. Vẽ kết quả Object Recognition (COCO-SSD)
  function drawObjects(predictions) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    detectedCount.textContent = predictions.length;

    predictions.forEach(pred => {
      const [x, y, width, height] = pred.bbox;
      const score = Math.round(pred.score * 100);
      const label = `${pred.class.toUpperCase()} ${score}%`;

      // Hộp nhận diện màu xanh dương hiện đại
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Viền góc
      const cornerLen = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Nhãn tên lớp vật thể
      ctx.font = '700 13px Manrope, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(14, 116, 144, 0.9)';
      ctx.fillRect(x, Math.max(0, y - 24), textWidth + 14, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 7, Math.max(16, y - 8));
    });
  }

  // 6. Vòng lặp suy luận thời gian thực (Inference Loop)
  async function renderPredictionLoop() {
    if (!isRunning) return;

    if (video.readyState >= 2) {
      try {
        if (currentMode === 'face' && faceDetector) {
          const faces = await faceDetector.estimateFaces(video, { flipHorizontal: false });
          drawFaces(faces);
        } else if (currentMode === 'object' && objectDetector) {
          const predictions = await objectDetector.detect(video);
          drawObjects(predictions);
        }

        // Đo FPS
        frameCount++;
        const now = performance.now();
        if (now - lastFrameTime >= 1000) {
          fpsDisplay.textContent = Math.round((frameCount * 1000) / (now - lastFrameTime));
          frameCount = 0;
          lastFrameTime = now;
        }
      } catch (err) {
        console.error("Lỗi suy luận:", err);
      }
    }

    animationFrameId = requestAnimationFrame(renderPredictionLoop);
  }

  // 7. Bật Camera và Pipeline
  startBtn.addEventListener('click', async () => {
    hideNotice();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNotice('Trình duyệt không hỗ trợ WebRTC getUserMedia trên giao thức này. Vui lòng mở bằng HTTPS hoặc localhost.', true);
      return;
    }

    startBtn.disabled = true;
    try {
      await ensureModelLoaded(currentMode);

      setStatus('Đang kết nối webcam...', 'loading');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      video.srcObject = stream;
      await new Promise(resolve => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.style.display = 'block';
      canvas.style.display = 'block';
      placeholder.style.display = 'none';

      isRunning = true;
      stopBtn.disabled = false;
      liveBadge.classList.add('active');
      liveText.textContent = 'AI DETECTING';
      badgeDot.style.background = '#3aab68';
      stageMode.textContent = 'REAL-TIME INFERENCE';
      setStatus('Mô hình đang chạy trực tiếp trên GPU WebGL.', 'ready');
      showNotice('Đang phát hiện thời gian thực! Bạn có thể chuyển đổi giữa Face Detection và Object Recognition bên trên.');

      lastFrameTime = performance.now();
      frameCount = 0;
      renderPredictionLoop();

    } catch (error) {
      startBtn.disabled = false;
      let msg = 'Lỗi khởi động: ' + error.message;
      if (error.name === 'NotAllowedError') {
        msg = 'Bạn chưa cấp quyền truy cập Camera. Hãy cho phép trên thanh địa chỉ URL.';
      }
      showNotice(msg, true);
      setStatus('Lỗi khởi động demo.', 'normal');
      modelStatus.textContent = 'Lỗi nạp';
    }
  });

  // 8. Dừng Camera
  function stopCamera() {
    isRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.pause();
    video.srcObject = null;
    video.style.display = 'none';
    canvas.style.display = 'none';
    placeholder.style.display = 'flex';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    startBtn.disabled = false;
    stopBtn.disabled = true;
    liveBadge.classList.remove('active');
    liveText.textContent = 'ĐÃ DỪNG';
    badgeDot.style.background = '#aab5ad';
    stageMode.textContent = 'PREVIEW MODE';
    detectedCount.textContent = '0';
    fpsDisplay.textContent = '—';
    setStatus('Đã dừng webcam và inference.');
  }

  stopBtn.addEventListener('click', () => {
    hideNotice();
    stopCamera();
  });

  resetBtn.addEventListener('click', () => {
    hideNotice();
    stopCamera();
    setStatus('Sẵn sàng tải mô hình và kết nối webcam.');
  });

  window.addEventListener('pagehide', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  });
})();