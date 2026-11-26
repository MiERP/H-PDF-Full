# Phát hành H-PDF

Tài liệu này là quy trình phát hành bản chính (`main`). Nhánh `lite` chỉ dùng để
build cục bộ, không có repo/release riêng. Số phiên bản dùng chung cho cả hai
nhánh.

## 1. Một phiên bản, một nguồn

`package.json` ở gốc là **nguồn duy nhất** của số phiên bản. Không sửa tay
`desktop/package.json` hay lockfile: `scripts/version.mjs` ghi số đó vào tất cả
các nơi cần thiết.

| Tệp                         | Được ghi gì                                  |
| --------------------------- | -------------------------------------------- |
| `package.json`              | `version` (nguồn)                            |
| `package-lock.json`         | `version` và `packages[""].version`          |
| `desktop/package.json`      | `version` — electron-builder đọc tệp này     |
| `desktop/package-lock.json` | `version` và `packages[""].version`          |
| `chart/Chart.yaml`          | `appVersion`; `version` của chart tăng riêng |

`chart/Chart.yaml` có hai số khác nhau: `appVersion` luôn bằng phiên bản ứng
dụng, còn `version` là phiên bản của chart Helm và chỉ tăng khi phát hành.

Kiểm tra bất cứ lúc nào:

```bash
npm run version:show          # in số hiện tại
npm run version:check         # lỗi nếu có tệp lệch
```

Đổi số khi cần (không phát hành):

```bash
npm run version:set -- 1.0.1
npm run version:patch         # 1.0.1 → 1.0.2
npm run version:minor         # 1.0.1 → 1.1.0
npm run version:major         # 1.0.1 → 2.0.0
```

## 2. Phát hành một phiên bản

```bash
# 1. Commit mọi thay đổi tính năng/sửa lỗi trước (cây làm việc phải sạch)
git add .
git commit -m "Mô tả thay đổi"

# 2. Một lệnh làm toàn bộ phần còn lại
npm run release          # bản vá
npm run release:minor    # thêm tính năng
npm run release:major    # thay đổi lớn
```

`scripts/release.mjs` làm theo thứ tự:

1. Tăng phiên bản trong tất cả các tệp ở trên và kiểm tra lại.
2. Chạy `npx tsc --noEmit` và `npm run test:run`.
3. Chạy `npm run desktop:dist` để tạo bộ cài Windows trong `release/` (bước này tải và kiểm tra mã băm mọi bộ xử lý đi kèm trước khi build).
4. Commit riêng `Release vX.Y.Z`.
5. Tạo `H-PDF-<edition>-<version>-Source.zip` từ đúng commit đó.
6. Tạo `SHA256SUMS-H-PDF-<edition>-<version>.txt`.
7. Push commit lên nhánh `main` của repo edition.
8. Tạo GitHub Release; GitHub tạo tag `vX.Y.Z` tại commit trên `main`. Đính kèm
   Setup, Portable, Source.zip và SHA256SUMS; đánh dấu là bản mới nhất.

Tag được tạo trên GitHub, không tạo tag local: các worktree dùng chung danh sách
tag, nên hai edition cùng phiên bản sẽ tranh nhau tag `vX.Y.Z`.

Các cờ hữu ích (đặt sau `--`):

```bash
npm run release -- --skip-tests
npm run release -- --skip-build      # dùng lại tệp đã có trong release/
npm run release -- --no-push         # chỉ commit ở máy
npm run release -- --no-github       # push nhưng chưa tạo Release
npm run release -- --allow-dirty     # bỏ kiểm tra cây làm việc sạch
```

## 3. Điều kiện để tạo Release

- `gh` đã đăng nhập (`gh auth login`) hoặc đặt biến `GH_TOKEN`.
- Remote trỏ tới repo chính: `https://github.com/MiERP/H-PDF-Full.git`.
- Phải đang ở nhánh `main`; script từ chối push từ nhánh khác (dùng `--no-push` nếu chỉ muốn commit cục bộ).
- Tag của release phải là **release mới nhất**. Nút _Kiểm tra cập nhật_ trong
  ứng dụng đọc `/releases/latest` và so tag đó với phiên bản đang chạy. Tag do
  GitHub tạo khi release được tạo; không cần tạo tag local.

Nhánh `lite` không có repo/release riêng. Bộ cài Lite được build từ nhánh đó
và đính vào release chính cùng tag:

```bash
# trong worktree/bản checkout của nhánh lite
npm run desktop:dist

# từ main, sau khi release đã được tạo
gh release upload vX.Y.Z .worktrees/lite/release/H-PDF-Lite-X.Y.Z-* \
  --repo MiERP/H-PDF-Full --clobber
```

Sau khi thêm asset Lite, cập nhật lại checksums và ghi chú release để có hash
của cả hai bản.

```bash
# repo chính dùng remote tên origin (mặc định)
npm run release

# nếu remote có tên khác
RELEASE_REMOTE=origin npm run release

# hoặc chỉ định thẳng repo, không cần remote
RELEASE_REPO=MiERP/H-PDF-Full npm run release
```

## 4. macOS và Linux

`npm run release` chỉ tạo bộ cài Windows tại máy. Sau khi Release đã có, chạy
workflow `.github/workflows/desktop-release.yml` (Actions → Run workflow) với
đúng tag `X.Y.Z`; workflow build từ tag đó và đính kèm DMG/AppImage/deb cùng
`SHA256SUMS` vào release hiện có.

## 5. Ghi chú

- Bộ cài chưa ký số. Windows SmartScreen có thể cảnh báo; macOS cần chuột phải →
  Open ở lần mở đầu.
- Release phải kèm mã nguồn đúng phiên bản (AGPL-3.0). `Source.zip` và tab
  _Source code_ của GitHub đáp ứng yêu cầu này.
- Không sửa số phiên bản trực tiếp trong `desktop/package.json`,
  `package-lock.json` hay `chart/Chart.yaml`; `npm run version:check` sẽ báo lệch.
