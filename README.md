# Topic 4: Machine Learning on the Web — FaceLens Real-time Face Detection

Dự án bài tập giữa kỳ môn Lập trình Web & Ứng dụng (Web Programming & Applications).

## 1. Cấu trúc thư mục dự án
```text
project-folder/
├── index.html       # Cấu trúc giao diện ứng dụng (Semantic HTML, CDN links)
├── style.css        # Toàn bộ CSS bố cục, màu sắc, hiệu ứng UI
├── app.js           # Mã nguồn logic xử lý WebGL, TensorFlow.js và Camera
└── README.md        # Tài liệu hướng dẫn cài đặt và báo cáo
```

## 2. Giới thiệu Đề tài
- **Mã đề tài:** Topic 4 — Machine Learning on the Web.
- **Mục tiêu:** Trình diễn khả năng chạy mô hình Trí tuệ Nhân tạo / Machine Learning trực tiếp trên trình duyệt (In-browser computation) bằng **TensorFlow.js** và **MediaPipe FaceDetector**.
- **Điểm nổi bật:**
  - Không cần máy chủ GPU đắt tiền để suy luận; toàn bộ quá trình dự đoán chạy 100% phía client.
  - Bảo mật dữ liệu người dùng (Privacy by design): Luồng camera không gửi bất kỳ frame hình nào lên server.
  - Tăng tốc phần cứng trực tiếp qua WebGL.

## 3. Hướng dẫn cài đặt và chạy thử nghiệm
Do tính năng Webcam (`getUserMedia`) yêu cầu môi trường an toàn (Secure Context - `localhost` hoặc `HTTPS`), bạn cần mở ứng dụng qua một Web Server cục bộ:

### Cách 1: Sử dụng Python (Đơn giản nhất)
1. Mở terminal/command prompt tại thư mục chứa mã nguồn:
   ```bash
   python -m http.server 8000
   ```
2. Mở trình duyệt và truy cập: `http://localhost:8000`

### Cách 2: Sử dụng VS Code Live Server
1. Cài extension **Live Server** trên VS Code.
2. Click chuột phải vào file `index.html` chọn **Open with Live Server**.

### Cách 3: Sử dụng Node.js `npx serve`
```bash
npx serve .
```

## 4. Hướng dẫn sử dụng
1. Nhấn nút **"Bật Camera & Chạy AI"**.
2. Cho phép trình duyệt truy cập Webcam khi được hỏi.
3. Ứng dụng sẽ nạp mô hình vào WebGL, hiển thị video trực tiếp, vẽ Bounding Box màu xanh kèm các điểm mốc (mắt, mũi, miệng) và cập nhật số lượng khuôn mặt cũng như chỉ số FPS theo thời gian thực.
