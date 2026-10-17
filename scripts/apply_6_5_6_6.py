import os
import time
import docx

doc_path = r"H:\NhaHang\NhaHang\BaoCao_KLTN_HeThongQuanLyNhaHang.docx"
hinh_6_5_path = r"H:\NhaHang\NhaHang\screenshots\hinh_6_5_tinh_tien.png"
hinh_6_6_path = r"H:\NhaHang\NhaHang\screenshots\hinh_6_6_doi_soat.png"

for retry in range(5):
    try:
        doc = docx.Document(doc_path)
        if "rId41" in doc.part.rels:
            with open(hinh_6_5_path, "rb") as f:
                doc.part.rels["rId41"].target_part._blob = f.read()
            print("-> Cập nhật rId41 (Hình 6.5) thành công!")

        if "rId42" in doc.part.rels:
            with open(hinh_6_6_path, "rb") as f:
                doc.part.rels["rId42"].target_part._blob = f.read()
            print("-> Cập nhật rId42 (Hình 6.6) thành công!")

        doc.save(doc_path)
        print(">>> ĐÃ LƯU THÀNH CÔNG VÀO FILE WORD! <<<")
        break
    except PermissionError:
        print(f"File Word đang mở, thử lại lần {retry+1}/5 sau 2 giây...")
        time.sleep(2)
