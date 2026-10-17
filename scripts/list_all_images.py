import docx
import os

doc_path = r"H:\NhaHang\NhaHang\BaoCao_KLTN_HeThongQuanLyNhaHang.docx"
doc = docx.Document(doc_path)

print("=== TẤT CẢ CÁC HÌNH ẢNH TRONG BÁO CÁO ===")
for i, p in enumerate(doc.paragraphs):
    xml = p._element.xml
    if "w:drawing" in xml or "w:pict" in xml:
        # Tìm caption ở paragraph ngay sau hoặc paragraph hiện tại
        caption = ""
        for j in range(max(0, i-2), min(len(doc.paragraphs), i+3)):
            t = doc.paragraphs[j].text.strip()
            if t.startswith("Hình ") or t.startswith("Ảnh "):
                caption = t
                break
        print(f"Index: {i} | Caption: {caption}")
