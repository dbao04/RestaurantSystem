# Hướng dẫn dùng Git — kéo / đẩy code lên GitHub

Repo: <https://github.com/dbao04/RestaurantSystem>
Thư mục làm việc: `D:\NhaHang\RestaurantSystem` (trong WSL là `/mnt/d/NhaHang/RestaurantSystem`)

> **Mọi lệnh git đều phải chạy TRONG thư mục `RestaurantSystem`.**
> Thư mục cha `D:\NhaHang` không phải là repo — chạy git ở đó sẽ báo `not a git repository`.
> ```bash
> cd /mnt/d/NhaHang/RestaurantSystem
> ```

---

## 0. Cài đặt một lần (chỉ làm lần đầu)

```bash
# Tên + email hiện lên mỗi commit (đang là vandoanblack / tocnuriflex@gmail.com)
git config --global user.name  "vandoanblack"
git config --global user.email "tocnuriflex@gmail.com"

# Nhớ mật khẩu/token GitHub, khỏi phải nhập lại mỗi lần push
git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"

# Khi pull thì nối lịch sử thẳng hàng, không đẻ ra commit "Merge branch..." rác
git config --global pull.rebase true

# Gắn nhánh doan với nhánh doan trên GitHub -> sau này chỉ cần gõ `git pull` / `git push`
git push -u origin doan
```

Lưu ý: GitHub **không nhận mật khẩu tài khoản** khi push. Khi nó hỏi password thì dán
**Personal Access Token**: GitHub → Settings → Developer settings → Personal access tokens
→ Tokens (classic) → Generate new token → tick quyền `repo`.

---

## 1. Vòng lặp hằng ngày (dùng 90% thời gian)

```bash
cd /mnt/d/NhaHang/RestaurantSystem

# --- TRƯỚC KHI SỬA: kéo code mới nhất về ---
git pull

# ... sửa code ...

# --- SAU KHI SỬA: xem mình đã đổi gì ---
git status              # liệt kê file đã đổi / thêm mới
git diff                # xem chi tiết từng dòng đã đổi

# --- ĐẨY LÊN ---
git add -A                              # đưa TẤT CẢ thay đổi vào giỏ
git commit -m "Sua loi tinh tien hoa don"   # đặt tên mô tả rõ việc đã làm
git push                                # đẩy lên GitHub
```

Ba lệnh cuối gộp lại cho nhanh:

```bash
git add -A && git commit -m "Noi dung thay doi" && git push
```

Chỉ muốn đẩy vài file thay vì tất cả:

```bash
git add admin/hoa_don.php css/style.css
git commit -m "Chinh giao dien hoa don"
git push
```

---

## 2. Xem "cái gì đã thay đổi" — phần quan trọng nhất về sau

```bash
git log --oneline -20                  # 20 commit gần nhất, mỗi cái 1 dòng
git log --oneline --graph --all -20    # kèm sơ đồ nhánh
git log --stat -5                      # 5 commit gần nhất + danh sách file bị đổi
git log -p -1                          # commit mới nhất + chi tiết từng dòng

git log --oneline -- admin/hoa_don.php # lịch sử riêng của 1 file
git show e5192d3                       # xem nguyên nội dung 1 commit (dán mã commit vào)
git diff HEAD~1 HEAD                   # so commit mới nhất với commit trước đó
git diff main doan                     # so 2 nhánh khác nhau chỗ nào

git blame admin/hoa_don.php            # dòng nào do ai sửa, lúc nào
```

Xem trên web cho dễ nhìn: <https://github.com/dbao04/RestaurantSystem/commits/doan>

---

## 3. Nhánh (branch)

Repo đang có các nhánh: `main`, `doan`, `demo`, `test`. Bạn đang ở **`doan`**.

```bash
git branch -a                # xem tất cả nhánh (dấu * là nhánh đang đứng)
git switch doan              # nhảy sang nhánh doan
git switch -c tinh-nang-moi  # tạo nhánh mới và nhảy vào luôn
git push -u origin tinh-nang-moi   # đẩy nhánh mới lên GitHub lần đầu

# Gộp nhánh doan vào main
git switch main
git pull
git merge doan
git push
```

---

## 4. Máy khác / cài lại máy — lấy code về

```bash
git clone https://github.com/dbao04/RestaurantSystem.git
cd RestaurantSystem
git switch doan
cp .env.example .env         # rồi điền lại thông tin DB (.env KHÔNG có trên GitHub)
npm install
```

---

## 5. Xử lý sự cố

| Tình huống | Lệnh |
|---|---|
| Push bị chối `rejected / non-fast-forward` (người khác đã đẩy trước) | `git pull` rồi `git push` lại |
| Lỡ sửa hỏng 1 file, muốn trả về như cũ | `git restore duong/dan/file.php` |
| Muốn bỏ **hết** thay đổi chưa commit | `git reset --hard` ⚠️ mất sạch, không lấy lại được |
| Lỡ commit nhưng chưa push, muốn sửa lời commit | `git commit --amend -m "Loi moi"` |
| Lỡ commit nhưng chưa push, muốn bỏ commit mà **giữ code** | `git reset --soft HEAD~1` |
| Đang sửa dở mà cần pull gấp | `git stash` → `git pull` → `git stash pop` |
| Xem repo trỏ về đâu | `git remote -v` |

**Khi bị xung đột (conflict) lúc pull:** mở file mà git báo, tìm các dấu

```
<<<<<<< HEAD
code của bạn
=======
code của người khác
>>>>>>> abc1234
```

Giữ lại phần đúng, xoá 3 dòng dấu `<<<`, `===`, `>>>`, rồi:

```bash
git add .
git rebase --continue     # nếu đang pull với rebase
git push
```

---

## 6. Những thứ **KHÔNG** được đẩy lên GitHub (đã chặn trong `.gitignore`)

- `.env` — mật khẩu database. **Tuyệt đối không đẩy lên.**
- `node_modules/`, `__pycache__/`, `*.log`
- `du_lieu_khuon_mat/`, `ml_service/mo_hinh_khuon_mat/*.onnx` — dữ liệu sinh trắc học
- `backup/`, `*.docx`, `*.zip`, `*.rar`, `*.csv`
- `config/chung-chi/` — chứng chỉ HTTPS tự ký

Kéo theo: **file báo cáo `.docx` và thư mục `_mysql_backup_...` ở `D:\NhaHang` không nằm trong repo**,
không được sao lưu lên GitHub. Muốn giữ an toàn thì tự chép ra ổ khác / Google Drive.

Kiểm tra trước khi commit xem có lỡ đưa file nhạy cảm vào không:

```bash
git status                       # nhìn danh sách file sắp commit
git check-ignore -v .env         # kiểm tra 1 file có đang bị chặn không
```

---

## 7. Tình trạng repo lúc viết hướng dẫn này (12/08/2026)

- Đang đứng ở nhánh `doan`, không có file nào đang sửa dở.
- Nhánh `doan` **chưa gắn** với `origin/doan` → `git pull` / `git push` trống không chạy được,
  phải chạy `git push -u origin doan` một lần (xem mục 0).
- Local `doan` (e5192d3) và `origin/doan` (e9b7a23) lệch nhau 1 commit mỗi bên, nhưng
  **nội dung code y hệt nhau** — chỉ là cùng một lần commit bị ghi 2 lần với 2 tên tác giả
  (`vandoanblack` và `dbao04`). Muốn dọn cho gọn, chạy:

  ```bash
  git fetch origin
  git reset --hard origin/doan     # an toàn: nội dung 2 bên giống hệt, không mất code
  git branch --set-upstream-to=origin/doan doan
  ```

  Sau bước này thì từ đó về sau chỉ cần `git pull` và `git push` trống là đủ.
