"""Chatbot hoi dap tieng Viet cho he thong quan ly nha hang.

Kien truc 5 tang (xem HUONG_DAN_CHATBOT.md):

    Cau hoi tieng Viet
        |
        v
    1. tien_xu_ly.py   chuan hoa: teencode, bo dau, gom khoang trang
        |
        v
    2. phan_loai.py    PHAN LOAI Y DINH  <- day la phan hoc may tu huan luyen
        |              (TF-IDF tu + n-gram ky tu -> LinearSVC / LogisticRegression)
        v
    3. thuc_the.py     trich xuat tham so: thoi gian, ten mon, nguyen lieu...
        |              tu dien thuc the sinh DONG tu CSDL
        v
    4. truy_van.py     anh xa (y dinh + tham so) -> mau SQL CO THAM SO
        |              KHONG sinh SQL tu do => khong the bi SQL injection
        v
    5. tra_loi.py      sinh cau tra loi tieng Viet + du lieu ve bieu do

Toan bo chay OFFLINE, khong goi API ben ngoai, khong can khoa API.
"""
