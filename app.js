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
  const faceCountDisplay = document.getElementById('faceCount');
  const fpsDisplay = document.getElementById('fpsValue');
  const modelStatus = document.getElementById('modelStatus');

  // 2. State Variables
  let stream = null;
  let detector = null;
  let animationFrameId = null;
  let isRunning = false;

  // Biến đo lường FPS
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let currentFps = 0;

  // 3. UI Helpers
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

  // 4. Load TensorFlow.js Face Detection Model
  async function loadFaceModel() {
    if (detector) return detector;
    setStatus('Đang khởi tạo backend WebGL và nạp mô hình TensorFlow.js...', 'loading');
    modelStatus.textContent = 'Đang nạp...';
    
    // Đảm bảo WebGL backend được chọn để tăng tốc phần cứng GPU
    await tf.setBackend('webgl');
    await tf.ready();

    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig = {
      runtime: 'tfjs',
      modelType: 'short' // Tối ưu hóa cho cự ly webcam gần, đạt tốc độ suy luận nhanh
    };
    detector = await faceDetection.createDetector(model, detectorConfig);
    modelStatus.textContent = 'MediaPipe TFJS';
    return detector;
  }

  // 5. Draw Bounding Boxes and Facial Keypoints
  function drawDetections(faces) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach(face => {
      const box = face.box;
      const score = Math.round((face.score || 0) * 100);

      // Bounding Box chính
      ctx.strokeStyle = '#38d976';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);

      // Hiệu ứng viền góc
      const cornerLen = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(box.xMin, box.yMin + cornerLen);
      ctx.lineTo(box.xMin, box.yMin);
      ctx.lineTo(box.xMin + cornerLen, box.yMin);
      ctx.stroke();

      // Hiển thị nhãn Confidence
      const labelText = `Face: ${score}%`;
      ctx.font = '600 13px Manrope, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      
      ctx.fillStyle = 'rgba(23, 34, 29, 0.85)';
      ctx.fillRect(box.xMin, Math.max(0, box.yMin - 24), textWidth + 14, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, box.xMin + 7, Math.max(16, box.yMin - 8));

      // Keypoints (mắt, mũi, miệng)
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

  // 6. Real-time Inference Loop
  async function renderPredictionLoop() {
    if (!isRunning) return;

    if (video.readyState >= 2 && detector) {
      try {
        const faces = await detector.estimateFaces(video, { flipHorizontal: false });
        faceCountDisplay.textContent = faces.length;
        drawDetections(faces);

        // Tính FPS
        frameCount++;
        const now = performance.now();
        if (now - lastFrameTime >= 1000) {
          currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
          fpsDisplay.textContent = currentFps;
          frameCount = 0;
          lastFrameTime = now;
        }
      } catch (err) {
        console.error("Lỗi khi suy luận:", err);
      }
    }

    animationFrameId = requestAnimationFrame(renderPredictionLoop);
  }

  // 7. Start Camera and AI Pipeline
  startBtn.addEventListener('click', async () => {
    hideNotice();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNotice('Trình duyệt không hỗ trợ WebRTC getUserMedia trên giao thức này. Vui lòng chạy trên HTTPS hoặc localhost.', true);
      return;
    }

    startBtn.disabled = true;
    try {
      await loadFaceModel();

      setStatus('Đang mở webcam...', 'loading');
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      video.srcObject = stream;
      await new Promise(resolve => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Điều chỉnh canvas khớp tỉ lệ với luồng video
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
      setStatus('Mô hình đang hoạt động và nhận diện liên tục trên WebGL.', 'ready');
      showNotice('Hệ thống đã nhận diện thành công trực tiếp trong trình duyệt!');

      lastFrameTime = performance.now();
      frameCount = 0;
      renderPredictionLoop();

    } catch (error) {
      startBtn.disabled = false;
      let msg = 'Không thể khởi động camera hoặc mô hình AI: ' + error.message;
      if (error.name === 'NotAllowedError') {
        msg = 'Bạn đã từ chối cấp quyền camera. Vui lòng cho phép quyền truy cập camera trên thanh địa chỉ URL.';
      }
      showNotice(msg, true);
      setStatus('Lỗi khởi động demo.', 'normal');
      modelStatus.textContent = 'Lỗi nạp';
    }
  });

  // 8. Stop Camera and Inference
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
    faceCountDisplay.textContent = '0';
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
