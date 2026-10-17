import docx
import os

doc_path = r"H:\NhaHang\NhaHang\BaoCao_KLTN_HeThongQuanLyNhaHang.docx"
doc = docx.Document(doc_path)

screenshot_dir = r"H:\NhaHang\NhaHang\screenshots"

# Mapping rId -> đường dẫn ảnh mới tương ứng
mapping = {
    "rId38": os.path.join(screenshot_dir, "hinh_6_2_so_do_ban_chi_tiet.png"),
    "rId39": os.path.join(screenshot_dir, "hinh_6_3_so_do_ban_tong_quan.png"),
    "rId40": os.path.join(screenshot_dir, "hinh_6_4_thu_ngan.png"),
    "rId41": os.path.join(screenshot_dir, "hinh_6_5_tinh_tien.png"),
    "rId42": os.path.join(screenshot_dir, "hinh_6_6_doi_soat.png"),
    "rId43": os.path.join(screenshot_dir, "hinh_6_7_lich_su_thanh_toan.png"),
    "rId44": os.path.join(screenshot_dir, "hinh_6_8_qr_menu_mobile.png"),
    "rId45": os.path.join(screenshot_dir, "hinh_6_9_cau_hinh_he_thong.png"),
}

for rId, img_path in mapping.items():
    if rId in doc.part.rels:
        rel = doc.part.rels[rId]
        image_part = rel.target_part
        if os.path.exists(img_path):
            with open(img_path, 'rb') as f:
                new_data = f.read()
            image_part._blob = new_data
            print(f"-> Cập nhật thành công {rId} với ảnh {os.path.basename(img_path)} ({len(new_data)} bytes)")
        else:
            print(f"X Không tìm thấy ảnh: {img_path}")

doc.save(doc_path)
print(">>> ĐÃ LƯU THÀNH CÔNG TẤT CẢ HÌNH ẢNH MỚI VÀO FILE WORD! <<<")
