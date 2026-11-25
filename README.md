<p align="center">
  <img src="public/images/h-pdf-logo.svg" width="112" alt="H-PDF Lite">
</p>

<h1 align="center">H-PDF Lite</h1>

<p align="center">
  <b>Nhánh rút gọn, chạy hoàn toàn ngoại tuyến của H-PDF.</b><br>
  Không tải bộ xử lý nặng, không dùng dịch vụ Internet.
</p>

> **Đây là nhánh `lite` của H-PDF.**
> Bản đầy đủ và bộ cài của cả hai edition nằm trong release chính:
> <https://github.com/MiERP/H-PDF-Full/releases/latest>.

## Bản Lite là gì?

- Chỉ giữ các công cụ xử lý PDF chạy được ngay trên máy, không cần tải thêm bộ xử lý.
- Bỏ các công cụ cần PyMuPDF, Ghostscript, LibreOffice hoặc kết nối Internet.
- Bộ cài nhỏ hơn bản đầy đủ, phù hợp máy yếu hoặc môi trường mạng bị chặn.
- Dùng chung phiên bản với `main` (hiện là **1.0.2**).

Bản đầy đủ có đủ hơn 100 công cụ, OCR tiếng Việt và các bộ xử lý đi kèm. Xem
[README của `main`](https://github.com/MiERP/H-PDF-Full#readme).

## Build

Cần Node.js 20 trở lên.

```bash
npm install
npm run desktop:dist
```

Bộ cài nằm trong `release/`:

- `H-PDF-Lite-<phiên bản>-Windows-x64-Setup.exe`
- `H-PDF-Lite-<phiên bản>-Windows-x64-Portable.exe`

Bộ cài Lite nằm trong release chính:
<https://github.com/MiERP/H-PDF-Full/releases/latest>
(`H-PDF-Lite-<phiên bản>-Windows-x64-Setup.exe` và `…-Portable.exe`).

## Giấy phép

H-PDF Lite chỉ phát hành theo
[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE). Không có giấy
phép thương mại hay giấy phép đóng nguồn nào khác.

- Bản quyền phần mã gốc: © BentoPDF Contributors.
- Bản quyền phần sửa đổi: © 2026 Phạm Văn Long - HAVS.
- Mã nguồn đầy đủ nằm trong nhánh `lite` của
  <https://github.com/MiERP/H-PDF-Full>.

Nếu chạy bản sửa đổi như một dịch vụ mạng, bạn phải cung cấp mã nguồn đầy đủ
của đúng bản đang chạy cho người dùng dịch vụ.
