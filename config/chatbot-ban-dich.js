/**
 * BAN DICH TIENG ANH / TIENG NHAT cho tro ly ao.
 *
 * Kho kien thuc (config/chatbot-kien-thuc-mau.js) viet bang tieng Viet. Khong co
 * dich may o day: moi cau tra loi duoc dich san, giu nguyen bien {ten_nha_hang},
 * {hotline}... Khach hoi bang EN/JA -> `hoi` (regex) nhan ra y -> chay bo may
 * bang cau hoi tieng Viet goc -> tra loi bang ban dich ben duoi.
 *
 * Khoa cua `kien_thuc` = cau_hoi CHINH trong kho (dung y chang chu). Quan tri
 * them cau moi trong kho ma chua co ban dich -> khach EN/JA nhan cau tieng Viet.
 *
 * {ten_khach}: EN = "there" / ten khach, JA = "お客様" / "<ten>様".
 */
module.exports = {
  kien_thuc: {
    // ---------------------------------------------------------- CHAO HOI
    'Xin chào': {
      en: [/^(hi|hello|hey|good (morning|afternoon|evening)|greetings)\b/, 'Hello {ten_khach} 👋 I\'m {ten_bot}, the virtual assistant of **{ten_nha_hang}**. I can show you the menu, help you book a table, plan a party or order delivery. Just message me whatever you need!'],
      ja: [/^(こんにちは|こんばんは|おはよう|はじめまして|もしもし|ハロー)/, 'こんにちは、{ten_khach} 👋 **{ten_nha_hang}** のAIアシスタント {ten_bot} です。メニューのご案内、テーブル予約、パーティーのご相談、デリバリーなどお手伝いできます。お気軽にどうぞ！'],
    },
    'Cảm ơn': {
      en: [/\b(thanks|thank you|thx|ty|appreciate)\b/, 'You\'re very welcome 🥰 Message me anytime if you need anything else!'],
      ja: [/(ありがとう|有難う|感謝|サンキュー)/, 'どういたしまして 🥰 ほかにご用があればいつでもどうぞ！'],
    },
    'Tạm biệt': {
      en: [/\b(bye|goodbye|see you|see ya|good night)\b/, 'Goodbye! Hope to see you at {ten_nha_hang} soon 👋'],
      ja: [/(さようなら|さよなら|またね|バイバイ|おやすみ|失礼します)/, 'ご利用ありがとうございました。{ten_nha_hang}でお待ちしております 👋'],
    },
    'Bạn là ai?': {
      en: [/(who are you|are you (a )?(bot|robot|human|real|ai)|your name|real person)/, 'I\'m **{ten_bot}**, the virtual assistant of {ten_nha_hang}, available 24/7 to answer you instantly 🤖. For things that need a real person, like urgent order changes or complaints, tap **Chat with staff** or call **{hotline}**.'],
      ja: [/(あなたは誰|だれ|ロボット|人間|ボット|名前は|AIですか)/, '{ten_nha_hang}のAIアシスタント **{ten_bot}** です。24時間いつでもすぐにお答えします 🤖。注文の急な変更やご意見など、スタッフ対応が必要な場合は **スタッフとチャット** または **{hotline}** へお電話ください。'],
    },
    'Bạn làm được gì?': {
      en: [/(what can you do|how can you help|what do you do|help me|^help$)/, 'Here\'s what I can help with:\n• **Menu, dish prices and photos**\n• **Table booking, party booking, deposits**\n• **Delivery**, fees and delivery time\n• **Promotions**, membership and points\n• Opening hours, address, parking\nJust ask naturally, like talking to our staff 😊'],
      ja: [/(何ができ|なにができ|手伝って|ヘルプ|使い方)/, '次のようなことをお手伝いできます：\n• **メニュー・価格・料理写真**\n• **テーブル予約・パーティー予約・デポジット**\n• **デリバリー**・送料・お届け時間\n• **キャンペーン**・会員特典・ポイント\n• 営業時間・住所・駐車場\nスタッフに話すように気軽に質問してください 😊'],
    },
    'Ok': {
      en: [/^(ok|okay|alright|sure|got it|yes|yep|cool|great|fine)[.!]*$/, 'Great 😊 Is there anything else I can help you with?'],
      ja: [/^(はい|了解|わかりました|オッケー|OK|いいです)[。！!]*$/i, 'かしこまりました 😊 ほかにお手伝いできることはありますか？'],
    },
    'Cho mình hỏi chút': {
      en: [/^(can i ask|i have a question|quick question|excuse me)/, 'Sure, go ahead, I\'m listening 😊 Do you need help with dishes, booking or delivery?'],
      ja: [/^(質問|ちょっと聞きたい|すみません|お聞きしたい)/, 'はい、どうぞ 😊 料理、ご予約、デリバリーなど何でもお尋ねください。'],
    },
    'Bạn khỏe không?': {
      en: [/(how are you|how'?s it going|how do you do)/, 'I\'m always great when I get to chat with you 😄 What would you like to eat today?'],
      ja: [/(元気ですか|お元気|調子はどう)/, '元気です、ありがとうございます 🥰 人気の料理をいくつかご紹介しましょうか？'],
    },
    'Bạn có người yêu chưa?': {
      en: [/(girlfriend|boyfriend|are you single|do you love|date me)/, 'Hehe, I\'m a virtual assistant, so the only thing I "love" is recommending great food to you 🥰 Shall I suggest some dishes for a date?'],
      ja: [/(恋人|彼女|彼氏|好きな人|付き合)/, 'ふふ、AIアシスタントなので「好き」なのはおいしい料理をおすすめすることだけです 🥰 デートにぴったりの料理をご紹介しましょうか？'],
    },
    'Khen bot': {
      en: [/(good (bot|job)|you'?re (smart|great|awesome|helpful)|nice|well done|amazing)/, 'Thank you so much 🥰 I\'ll keep doing my best!'],
      ja: [/(すごい|賢い|えらい|助かる|いいね|素晴らしい)/, 'ありがとうございます 🥰 これからも頑張ります！'],
    },
    'Chê bot / bot trả lời sai': {
      en: [/(wrong|stupid|useless|doesn'?t make sense|not what i asked|you don'?t understand)/, 'I\'m sorry I didn\'t understand you correctly 🙏 Please rephrase a little, or tap **Chat with staff** for direct help.'],
      ja: [/(違う|間違|役に立たない|わかってない|意味不明)/, '正しく理解できず申し訳ございません 🙏 もう少し詳しく教えていただくか、**スタッフとチャット**をタップしてください。'],
    },
    'Mình đói quá': {
      en: [/\b(i'?m (so )?hungry|starving)\b/, 'Then let\'s eat right away 😋 Would you like to **dine in** or get it **delivered**? Here are our most ordered dishes!'],
      ja: [/(お腹(が)?(すいた|空いた|ペコペコ)|腹減)/, 'それはすぐに食べなきゃですね 😋 **ご来店** と **デリバリー** どちらがよろしいですか？人気の料理をご紹介します！'],
    },
    'Nhà hàng có ngon không?': {
      en: [/(is (the food|it) good|is the restaurant good|tasty|delicious)/, 'I may be a little biased, but honestly it\'s really good 😄 Seafood is delivered **fresh every day**, our chefs specialise in Japanese cuisine and many guests come back regularly. See real guest reviews in **Reviews**!'],
      ja: [/(美味しい|おいしい|味はどう|評判)/, '少しひいきかもしれませんが、本当においしいです 😄 魚介は**毎日新鮮に仕入れ**、日本料理専門のシェフが調理し、リピーターのお客様も多いです。**レビュー**で実際の声をご覧ください！'],
    },
    'Giá cả ở nhà hàng thế nào?': {
      en: [/(expensive|cheap|price range|how much (does it|do meals) cost|average price|prices like)/, 'Our menu has **{so_mon} items**, from **{gia_thap}** (drinks), dishes from **{gia_mon_thap}**, and premium sets/hot pots up to **{gia_cao}** 💰. Two people ordering some sushi, sashimi and a hot dish will eat very well. Type "under 100k" and I\'ll filter budget-friendly dishes!'],
      ja: [/(高い|安い|価格帯|予算|値段はどのくらい|相場)/, 'メニューは **{so_mon}品**、ドリンク **{gia_thap}** から、料理は **{gia_mon_thap}** から、高級セット・鍋は **{gia_cao}** までございます 💰。2名様で寿司・刺身・温かい料理を数品頼めば十分満足いただけます。'],
    },
    // ---------------------------------------------------------- THONG TIN
    'Nhà hàng mở cửa mấy giờ?': {
      en: [/(opening hours|open(ing)? time|what time.*(open|close)|when.*(open|close)|business hours|are you open)/, 'We are open **{gio_mo_cua}** every day of the week, including weekends and holidays ⏰. Last orders are taken 30 minutes before closing.'],
      ja: [/(営業時間|何時から|何時まで|開店|閉店|開いて)/, '**{gio_mo_cua}**、週末・祝日を含め毎日営業しております ⏰。ラストオーダーは閉店30分前です。'],
    },
    'Lễ Tết có mở cửa không?': {
      en: [/(holiday|tet|new year|christmas)/, 'We are **open on holidays, Tết and weekends** 🎉. During Lunar New Year the schedule may change for a few days and will be announced on our website and fanpage. Holidays are usually very busy, so please **book ahead**!'],
      ja: [/(祝日|休日|正月|テト|年末年始|定休日)/, '**祝日・テト・週末も営業**しております 🎉。旧正月期間は数日スケジュールが変わる場合があり、ウェブサイトでお知らせします。混雑しますので**事前のご予約**をおすすめします！'],
    },
    'Địa chỉ nhà hàng ở đâu?': {
      en: [/(address|where (are you|is the restaurant|is it)|location|directions|how (do i|to) get there|google maps)/, 'We are at **{dia_chi}** 📍. Tap the button below to open Google Maps for directions!'],
      ja: [/(住所|場所|どこ|アクセス|行き方|地図)/, '店舗は **{dia_chi}** にあります 📍。下のボタンからGoogleマップで道順をご確認ください！'],
    },
    'Có chỗ đậu xe không?': {
      en: [/(parking|park (my|a|the) (car|bike|motorbike))/, 'Yes 🚗 We have **free motorbike and car parking** for dining guests. Just tell the security staff when you arrive.'],
      ja: [/(駐車|駐輪|パーキング|車で行)/, 'はい 🚗 お食事のお客様は**バイク・車の駐車場を無料**でご利用いただけます。到着時に警備スタッフへお声がけください。'],
    },
    'Số điện thoại / hotline nhà hàng': {
      en: [/(phone( number)?|hotline|contact|call you|zalo)/, 'You can reach us at **hotline/Zalo {hotline}** 📞 or message our staff directly in the **Chat** section of the website.'],
      ja: [/(電話|連絡先|ホットライン|問い合わせ|ザロ)/, '**ホットライン/Zalo {hotline}** 📞、またはウェブサイトの**チャット**からスタッフへ直接ご連絡ください。'],
    },
    'Nhà hàng có wifi không?': {
      en: [/\b(wifi|wi-fi|internet|password)\b/, 'Yes 📶 We have free wifi. Password: **{wifi}**. Ask our staff if you can\'t connect.'],
      ja: [/(wifi|wi-fi|ワイファイ|インターネット|パスワード)/i, 'はい 📶 無料Wi-Fiがございます。パスワード：**{wifi}**。接続できない場合はスタッフにお尋ねください。'],
    },
    'Nhà hàng phục vụ món gì? Phong cách gì?': {
      en: [/(what (kind of|type of) (food|cuisine|restaurant)|what do you serve|cuisine|japanese food)/, '{ten_nha_hang} is a **Japanese restaurant** 🇯🇵: sushi, sashimi, nigiri, maki, Japanese oysters, hot pot, grilled dishes, teppanyaki, udon, tempura… Seafood arrives fresh daily, served in the spirit of omotenashi. Would you like to see the menu?'],
      ja: [/(何料理|どんな料理|料理のジャンル|日本料理|和食)/, '{ten_nha_hang}は**日本料理店**です 🇯🇵 寿司、刺身、握り、巻き寿司、日本産牡蠣、鍋、焼き物、鉄板焼き、うどん、天ぷら…魚介は毎日新鮮に仕入れ、おもてなしの心でご提供します。メニューをご覧になりますか？'],
    },
    'Không gian nhà hàng thế nào?': {
      en: [/(atmosphere|space|interior|ambien|seating area|what does it look like|photos of the restaurant)/, 'We have several areas: a **sushi counter** where you can watch the chefs, **teppanyaki tables**, the main hall and **private VIP rooms** for families, business guests or small parties ✨. See photos with the button below.'],
      ja: [/(雰囲気|店内|空間|内装|席の種類)/, '店内には、職人の技を間近で見られる**寿司カウンター**、**鉄板焼き席**、メインホール、ご家族や接待・少人数パーティー向けの**個室VIP**がございます ✨。下のボタンから写真をご覧ください。'],
    },
    'Có chỗ cho trẻ em không?': {
      en: [/(kid|child|children|baby|high chair|family friendly)/, 'We have **baby high chairs** and families are always welcome 👨‍👩‍👧. Add a note "with small children" when booking so we can prepare a high chair and a comfortable spot.'],
      ja: [/(子供|子ども|こども|キッズ|赤ちゃん|ベビー|ベビーチェア)/, '**ベビーチェア**をご用意しており、ご家族連れも大歓迎です 👨‍👩‍👧。ご予約時に「子供連れ」とご記入いただければ、席をご準備いたします。'],
    },
    'Có mang thú cưng vào được không?': {
      en: [/\b(pet|pets|dog|dogs|cat|cats)\b/, 'To keep the dining area hygienic, we **don\'t allow pets inside** 🐾. Thank you for understanding!'],
      ja: [/(ペット|犬|猫|わんちゃん)/, '衛生上の理由により、**ペットの店内同伴はご遠慮いただいております** 🐾。ご理解のほどよろしくお願いいたします。'],
    },
    'Có cho hút thuốc không?': {
      en: [/\b(smok(e|ing)|cigarette|vape)\b/, 'The dining area is **non-smoking**. You may smoke in the outdoor area at the front 🙏'],
      ja: [/(喫煙|タバコ|たばこ|禁煙)/, '**客席は禁煙**です。店舗前の屋外スペースで喫煙いただけます 🙏'],
    },
    'Mang đồ ăn/rượu từ ngoài vào được không?': {
      en: [/(bring (my own|our own|outside)|byo|corkage|own (wine|cake|alcohol))/, 'You may **bring a birthday cake** free of charge 🎂. For wine or alcohol brought in, we charge a **corkage fee**; let us know when booking and staff will tell you the exact fee.'],
      ja: [/(持ち込み|持込|コルクチャージ)/, '**誕生日ケーキの持ち込みは無料**です 🎂。お酒の持ち込みは**持ち込み料**をいただきます。ご予約時にお知らせいただければ料金をご案内します。'],
    },
    // ---------------------------------------------------------- DAT BAN
    'Làm sao để đặt bàn?': {
      en: [/(book(ing)? a table|reserve|reservation|how (do i|to) book|table for)/, 'Booking online takes just a minute 🗓️:\n1. Tap **Book a table now** below\n2. Choose the date, time, number of guests and area\n3. Enter your name and phone number, then confirm\nWe\'ll send you a confirmation right away. You can also call **{hotline}**!'],
      ja: [/(予約したい|予約方法|予約する|席を予約|テーブル予約|予約できますか|\d+名.*予約|予約.*\d+名)/, 'オンライン予約は1分で完了します 🗓️：\n1. 下の **今すぐ予約** をタップ\n2. 日付・時間・人数・エリアを選択\n3. お名前と電話番号を入力して確定\n確定後すぐに確認のご連絡をお送りします。**{hotline}** へのお電話でも承ります！'],
    },
    'Đặt bàn có cần cọc không?': {
      en: [/(deposit)/, 'Small groups booking outside peak hours usually **don\'t need a deposit**. For large groups, peak hours or VIP rooms we ask for a **holding deposit**, which is deducted from your bill when you dine 💳. The exact amount is shown during booking.'],
      ja: [/(デポジット|前金|保証金|内金)/, '少人数・ピーク時間外のご予約は通常**デポジット不要**です。大人数、ピーク時間、VIPルームの場合は**予約金**をお願いしており、お食事時にお会計から差し引きます 💳。金額は予約画面に表示されます。'],
    },
    'Hủy bàn có được hoàn cọc không?': {
      en: [/(refund|get (my|the) deposit back)/, 'If you cancel **before the deadline** you\'ll get your **deposit refunded**. Late cancellations or no-shows may not be refunded. Cancel in **Booking history** or call **{hotline}** for help 🙏'],
      ja: [/(返金|返してもら|払い戻し)/, '**規定の期限までにキャンセル**された場合は**デポジットを返金**いたします。直前のキャンセルや無断キャンセルは返金できない場合があります。**予約履歴**からキャンセル、または **{hotline}** へご連絡ください 🙏'],
    },
    'Hủy đặt bàn thế nào?': {
      en: [/(cancel (my |a |the )?(booking|reservation|table))/, 'Go to **Booking history** (account menu) → choose the booking → tap **Cancel**. If you\'re not logged in or it\'s urgent, call **{hotline}** and staff will cancel it for you.'],
      ja: [/(予約.*キャンセル|キャンセル.*予約|予約を取り消)/, '**予約履歴**（アカウントメニュー）→ 予約を選択 → **キャンセル** をタップしてください。ログインしていない場合やお急ぎの場合は **{hotline}** へお電話ください。'],
    },
    'Đổi giờ / đổi số người đặt bàn được không?': {
      en: [/(change|modify|reschedule).*(booking|reservation|time|date|guests|people)/, 'Sure 👍 Call **{hotline}** or use **Chat with staff** to change the time, date or number of guests. We hold your table for **15 minutes** after the booking time; if you\'ll be later, please let us know.'],
      ja: [/(予約.*(変更|時間を変|人数を変)|(時間|人数|日付).*変更)/, 'はい 👍 **{hotline}** または **スタッフとチャット** で時間・日付・人数を変更できます。お席は予約時間から**15分間**お取りしています。遅れる場合は事前にご連絡ください。'],
    },
    'Đặt bàn cho nhóm đông người': {
      en: [/(large group|big group|group of \d{2}|\d{2} (people|guests)|company (dinner|party)|team dinner)/, 'We welcome large groups and have **VIP rooms / private areas** for companies, reunions and get-togethers 🎊. For about 15 guests or more, please use **Party booking** to get set-menu advice and an all-inclusive quote.'],
      ja: [/(大人数|団体|グループ|\d{2}名|会社の飲み会|歓迎会|送別会)/, '大人数のご利用も大歓迎です。会社の集まりや同窓会向けの**VIPルーム・貸切エリア**がございます 🎊。15名様以上の場合は**パーティー予約**からセットメニューとお見積りをご相談ください。'],
    },
    'Có phòng VIP không?': {
      en: [/(vip|private room)/, 'Yes ✨ We have **private VIP rooms** suitable for business guests, families and small parties. VIP rooms usually require a **holding deposit**. Choose the VIP area when booking.'],
      ja: [/(vip|個室|プライベートルーム)/i, 'はい ✨ 接待やご家族、少人数パーティーに最適な**個室VIPルーム**がございます。VIPルームは通常**予約金**が必要です。予約時にVIPエリアをお選びください。'],
    },
    'Không đặt trước có ăn được không?': {
      en: [/(walk[- ]in|without (a )?(booking|reservation)|no reservation)/, 'Walk-ins are welcome if tables are available 😊. However, **weekend evenings and peak hours** are often full, so a 1-minute online booking is safer!'],
      ja: [/(予約なし|予約しないで|飛び込み|ウォークイン)/, '空席があれば予約なしでもご利用いただけます 😊。ただし**週末の夜やピーク時間**は満席になりやすいので、オンライン予約がおすすめです！'],
    },
    'Giờ cao điểm là mấy giờ?': {
      en: [/(peak hours?|busy (time|hours)|when is it (busy|crowded)|rush hour)/, 'We\'re usually busiest in the **evening 18:00–21:00** and at **weekend lunch**. For a quieter atmosphere, come at weekday lunch or after 20:30 🙂'],
      ja: [/(混む|混雑|ピーク|空いている時間)/, '**夜18:00〜21:00** と **週末のランチ** が特に混み合います。落ち着いてお過ごしになりたい場合は、平日のランチか20:30以降がおすすめです 🙂'],
    },
    'Kiểm tra đơn đặt bàn của tôi': {
      en: [/(check|see|view|status of) (my )?(booking|reservation)/, 'Log in and open **Booking history** to see the status and details, or cancel 📋. Party bookings are in the **Party history** tab on the same page.'],
      ja: [/(予約(の)?(確認|状況|状態)|私の予約)/, 'ログイン後、**予約履歴**で状況・詳細の確認やキャンセルができます 📋。パーティー予約は同じページの**パーティー履歴**タブにあります。'],
    },
    // ---------------------------------------------------------- DAT TIEC
    'Nhà hàng có nhận đặt tiệc không?': {
      en: [/(party|parties|event|wedding|celebration|banquet|gala|year[- ]end)/, 'Yes 🥂 We host **birthday parties, company events, year-end parties, galas, family gatherings and small weddings**. Send a request in **Party booking** and our staff will contact you soon with menu advice and a quote!'],
      ja: [/(パーティー|宴会|イベント|結婚式|ウェディング|忘年会|ガラ|貸切)/, 'はい 🥂 **誕生日会、会社の宴会、忘年会、ガラ、ご家族の集まり、小規模ウェディング**を承っております。**パーティー予約**からご依頼いただければ、スタッフがメニューとお見積りをご案内します！'],
    },
    'Thực đơn tiệc giá bao nhiêu?': {
      en: [/(party (menu|package|price)|banquet (menu|price)|set menu price)/, 'We offer several **party menu packages** by budget per guest, and you can also **choose dishes yourself** when booking online 🍱. Prices show as soon as you pick a package; our staff will call to finalise details.'],
      ja: [/(パーティー|宴会).*(メニュー|料金|値段|プラン|価格)/, '1名様あたりのご予算に合わせた**パーティープラン**を複数ご用意しており、オンライン予約時に**料理を自由に選ぶ**こともできます 🍱。プランを選ぶと価格が表示され、スタッフが詳細をご確認のお電話をします。'],
    },
    'Đặt cọc tiệc thế nào?': {
      en: [/(party|event|banquet).*(deposit|pay)/, 'Once staff confirm the menu, you **pay a deposit at the set rate** to secure the date; the rest is paid after the party 💳. While the party is still a **New request**, you can cancel it yourself in **Party history**.'],
      ja: [/(パーティー|宴会).*(デポジット|前金|支払)/, 'スタッフがメニューを確定した後、**規定の割合でデポジット**をお支払いいただき日程を確保します。残金はパーティー後のお支払いです 💳。**新規リクエスト**の状態であれば**パーティー履歴**からご自身でキャンセルできます。'],
    },
    'Tổ chức sinh nhật được không?': {
      en: [/(birthday)/, 'Of course 🎂 Add the note **"birthday"** when booking and we\'ll help prepare the table, candles and a greeting. You can **bring a cake** free of charge. For custom decorations, book via **Party booking** for advice!'],
      ja: [/(誕生日|バースデー)/, 'もちろんです 🎂 ご予約時に**「誕生日」**とご記入いただければ、お席・キャンドル・メッセージをご用意します。**ケーキの持ち込みは無料**です。装飾をご希望の場合は**パーティー予約**からご相談ください！'],
    },
    // ---------------------------------------------------------- THUC DON
    'Cho mình xem thực đơn': {
      en: [/(menu|what (dishes|food) do you have|show me the (food|dishes)|recommend|what'?s good|popular dish)/, 'Our menu has **{so_mon} Japanese items** from {gia_thap}: **sashimi, sushi, nigiri, maki, Japanese oysters, hot pot, grilled dishes, teppanyaki, udon/ramen, tempura, desserts and drinks** 🍣. Tap the button below to see the full menu with photos, or type a dish name and I\'ll send the price and photo!'],
      ja: [/(メニュー|おすすめ|お勧め|オススメ|何がある|料理を見)/, '当店のメニューは **{so_mon}品** の日本料理で、{gia_thap} からございます：**刺身、寿司、握り、巻き寿司、日本産牡蠣、鍋、焼き物、鉄板焼き、うどん/ラーメン、天ぷら、デザート、ドリンク** 🍣。下のボタンから写真付きの全メニューをご覧いただくか、料理名を入力していただければ価格と写真をお送りします！'],
    },
    'Có combo / set không?': {
      en: [/\b(combo|combos|set meal|sets?)\b/, 'Yes 🍱 We have many **combos and sashimi/sushi sets** that cost less than ordering individually, great for couples, friends or families. See them in **Combo**!'],
      ja: [/(コンボ|セット|盛り合わせ)/, 'はい 🍱 単品より**お得なコンボや刺身・寿司セット**を多数ご用意しています。お二人、ご友人、ご家族にぴったりです。**コンボ**ページをご覧ください！'],
    },
    'Có món chay không?': {
      en: [/(vegetarian|vegan|no meat|plant[- ]based)/, 'Our menu is mostly seafood and meat, but there are dishes for vegetarians such as **seaweed salad, cucumber maki, rolled omelette, tofu and vegetable tempura** 🥗. Tell our staff you\'re "vegetarian" and the kitchen will advise and prepare sauces separately.'],
      ja: [/(ベジタリアン|ヴィーガン|菜食|精進|肉なし)/, 'メニューは魚介と肉料理が中心ですが、**海藻サラダ、かっぱ巻き、卵焼き、豆腐、野菜天ぷら**などベジタリアン向けの料理もございます 🥗。スタッフに「ベジタリアン」とお伝えいただければ、ソースも別にご用意します。'],
    },
    'Có món cho người không ăn được đồ sống?': {
      en: [/(cooked|no raw|can'?t eat raw|don'?t eat raw|pregnan)/, 'There are plenty of **fully cooked** options 🔥: **fried rice, udon, hot pot, teriyaki grilled fish, teppanyaki beef, tempura, miso soup, cheese fries**… If you\'re pregnant, avoid sashimi/raw oysters and let our staff advise you.'],
      ja: [/(生(もの|物)?(が)?(食べられない|苦手|ダメ)|火を通した|加熱|妊娠)/, '**しっかり火を通した料理**も多数ございます 🔥：**チャーハン、うどん、鍋、焼き魚の照り焼き、牛肉の鉄板焼き、天ぷら、味噌汁、チーズポテト**など。妊娠中の方は刺身・生牡蠣を避け、スタッフにご相談ください。'],
    },
    'Món có cay không? Làm bớt cay được không?': {
      en: [/\b(spicy|spice|chili|hot sauce)\b/, 'Most Japanese dishes are **not spicy**; the few with spicy sauce are labelled in the dish name. Add a note **"not spicy / mild / extra spicy"** when ordering and the kitchen will adjust 🌶️'],
      ja: [/(辛い|辛さ|からい|スパイシー|唐辛子)/, '日本料理の多くは**辛くありません**。辛いソースを使う料理は料理名に明記しています。ご注文時に**「辛さなし/控えめ/辛め」**とご記入いただければ調整します 🌶️'],
    },
    'Tôi bị dị ứng hải sản / đậu phộng': {
      en: [/(allerg|peanut|gluten|intoleran)/, 'Thank you for letting us know 🙏 Check the **ingredients** on each dish\'s detail page and **tell our staff when ordering** so the kitchen can avoid cross-contamination. We can note seafood, egg, soy, sesame and gluten allergies.'],
      ja: [/(アレルギー|ピーナッツ|落花生|グルテン)/, '事前にお知らせいただきありがとうございます 🙏 各料理の詳細ページで**原材料**をご確認のうえ、**ご注文時にスタッフへお伝えください**。魚介、卵、大豆、ごま、グルテンなどに対応いたします。'],
    },
    'Hải sản có tươi không? Nhập từ đâu?': {
      en: [/(fresh|where.*(seafood|fish).*from|origin|imported)/, 'We receive seafood **fresh every day**: Norwegian salmon, Hyogo oysters from Japan, scallops, tuna, shrimp… all with **clear origin** and stored at proper sashimi-grade temperatures 🐟. Anything below standard never leaves the kitchen.'],
      ja: [/(新鮮|鮮度|産地|仕入れ|どこから)/, '魚介は**毎日新鮮に仕入れ**ています：ノルウェー産サーモン、兵庫県産牡蠣、ホタテ、マグロ、エビなど、**産地が明確**で刺身用に適切な温度で保管しています 🐟。基準に満たないものはお出ししません。'],
    },
    'Có món mới không?': {
      en: [/(new (dish|dishes|item|menu)|what'?s new|seasonal)/, 'We update dishes by season regularly ✨. Check the **Menu** for the newest items, or type "best sellers" and I\'ll suggest guest favourites!'],
      ja: [/(新メニュー|新しい料理|季節限定|新作)/, '季節ごとにメニューを更新しています ✨。**メニュー**で最新の料理をご覧いただくか、「人気」と入力していただければおすすめをご紹介します！'],
    },
    'Gọi món mang về được không?': {
      en: [/(take ?away|take ?out|to go|pick ?up)/, 'Yes 🥡 Order online in the **Menu** and choose **takeaway** or **delivery** at checkout. Raw dishes like sashimi are best eaten within 30 minutes.'],
      ja: [/(持ち帰り|テイクアウト|お持ち帰り)/, 'はい 🥡 **メニュー**からオンラインでご注文いただき、お会計時に**持ち帰り**または**デリバリー**をお選びください。刺身などの生ものは30分以内にお召し上がりください。'],
    },
    // ---------------------------------------------------------- GIAO HANG
    'Nhà hàng có giao hàng không?': {
      en: [/(deliver|delivery)/, 'Yes 🛵 We **deliver to your door** within our service area. Choose dishes in the **Menu** → go to the cart → select **Delivery**; the fee and time are calculated automatically. You can even track the courier live on the map!'],
      ja: [/(デリバリー|配達|出前|宅配|届けて)/, 'はい 🛵 配達エリア内で**ご自宅までお届け**します。**メニュー**で料理を選び → カートへ → **デリバリー**を選択すると、送料と時間が自動で計算されます。配達員の位置も地図でリアルタイムに確認できます！'],
    },
    'Phí giao hàng bao nhiêu?': {
      en: [/(delivery (fee|charge|cost)|shipping (fee|cost)|free delivery|free shipping)/, 'The delivery fee **depends on distance** and is shown in the cart. Orders from **500,000đ** get **free delivery** 🎁 (within the service radius). See the Delivery policy for details.'],
      ja: [/(送料|配達料|配送料|デリバリー料金|無料配達)/, '送料は**距離によって異なり**、カートに表示されます。**500,000ドン**以上のご注文は**送料無料**です 🎁（配達エリア内）。詳しくは配達ポリシーをご覧ください。'],
    },
    'Giao trong bao lâu?': {
      en: [/(how long.*(deliver|delivery|take)|delivery time|how fast)/, 'Usually **30–45 minutes** depending on distance and peak hours ⏱️. After ordering, track the courier live on the **Track order** page.'],
      ja: [/(どのくらい(で|かか)|配達時間|届くまで|何分)/, '距離や混雑状況により、通常**30〜45分**でお届けします ⏱️。ご注文後は**注文追跡**ページで配達員の位置をご確認いただけます。'],
    },
    'Giao hàng tới đâu? Bán kính bao xa?': {
      en: [/(delivery (area|radius|zone|range)|how far.*deliver|deliver to my (area|address))/, 'We deliver within about **5 km** of the restaurant 📍. Enter your address in the cart and the system will tell you right away whether we deliver there and the fee.'],
      ja: [/(配達(エリア|範囲|地域)|どこまで(配達|届け))/, 'レストランから約**5km圏内**にお届けします 📍。カートで住所を入力すると、配達可能かどうかと送料がすぐに表示されます。'],
    },
    'Theo dõi đơn hàng của tôi': {
      en: [/(track|where is my (order|food)|order status|my order)/, 'Go to **Order history** → choose the order → **Track** to see the courier on the map in real time 🗺️. If it\'s very late, call **{hotline}** and we\'ll check urgently.'],
      ja: [/(注文(の)?(状況|追跡|確認)|追跡|まだ届かない|私の注文)/, '**注文履歴** → 注文を選択 → **追跡** で配達員の位置を地図でリアルタイムに確認できます 🗺️。大幅に遅れている場合は **{hotline}** へご連絡ください。'],
    },
    'Hủy đơn giao hàng được không?': {
      en: [/(cancel (my |the |an )?order)/, 'Orders **not yet being prepared** can be cancelled in **My orders**. If the kitchen has started or it\'s out for delivery, call **{hotline}** for help 🙏'],
      ja: [/(注文.*キャンセル|キャンセル.*注文)/, '**調理前のご注文**は**マイオーダー**からキャンセルできます。調理済み・配達中の場合は **{hotline}** へご連絡ください 🙏'],
    },
    // ---------------------------------------------------------- THANH TOAN
    'Thanh toán bằng cách nào?': {
      en: [/(pay(ment)?|cash|card|credit|bank transfer|vietqr|qr code)/, 'We accept **cash, bank transfer, VietQR** and **cards** 💳. When dining in you can scan the QR at your table; for online orders, pay by QR during checkout.'],
      ja: [/(支払|決済|現金|カード|振込|QR)/i, '**現金、銀行振込、VietQR**、**カード**をご利用いただけます 💳。店内ではテーブルのQRコードで、オンライン注文はお会計画面のQRでお支払いいただけます。'],
    },
    'Có xuất hóa đơn VAT không?': {
      en: [/(vat|invoice|receipt|tax)/, 'Yes 🧾 Give our staff your **company details (name, tax code, address, email)** when paying and we\'ll issue an **electronic VAT invoice** by email.'],
      ja: [/(領収書|請求書|インボイス|VAT|税)/i, 'はい 🧾 お会計時に**会社情報（社名・税番号・住所・メール）**をスタッフへお伝えいただければ、**電子VATインボイス**をメールでお送りします。'],
    },
    'Giá đã gồm VAT và phí phục vụ chưa?': {
      en: [/(include.*(vat|tax|service)|service (charge|fee))/, 'Menu prices are dish prices; **VAT and any surcharge** are shown clearly on the bill before you pay. For an exact quote for a large group, message our staff.'],
      ja: [/(税込|税抜|サービス料)/, 'メニュー価格は料理の価格です。**VATおよび追加料金（ある場合）**はお支払い前の伝票に明記されます。大人数で正確なお見積りが必要な場合はスタッフへご連絡ください。'],
    },
    // ---------------------------------------------------------- KHUYEN MAI
    'Có khuyến mãi gì không?': {
      en: [/(promotion|promo|discount|deal|offer|coupon|voucher code|sale)/, 'We have plenty of great offers 🎉: **discount codes** for members, **points for rewards**, birthday offers and **free delivery** on orders from 500,000đ. See the current codes in **Offers**!'],
      ja: [/(キャンペーン|割引|クーポン|セール|特典|お得)/, 'お得な特典を多数ご用意しています 🎉：会員向け**割引コード**、**ポイント交換**、誕生日特典、500,000ドン以上で**送料無料**など。現在のコードは**特典**ページでご確認ください！'],
    },
    'Thẻ thành viên có lợi gì?': {
      en: [/(member(ship)?|loyalty|points|reward)/, 'Create an account and you\'re a **member** right away 💎. Every bill **earns points**, higher tiers get bigger perks, and points can be **exchanged for discount codes**. See full benefits on the **Membership** page!'],
      ja: [/(会員|メンバー|ポイント|ロイヤリティ)/, 'アカウント登録ですぐに**会員**になれます 💎。お会計ごとに**ポイントが貯まり**、ランクが上がるほど特典が充実し、ポイントは**割引コードと交換**できます。詳しくは**会員**ページをご覧ください！'],
    },
    'Ưu đãi sinh nhật': {
      en: [/(birthday (offer|discount|gift|promotion|deal))/, 'Members get **special offers in their birthday month** 🎁. Remember to add your date of birth to your profile to receive it!'],
      ja: [/(誕生日(特典|割引|クーポン|プレゼント))/, '会員様には**誕生月の特別特典**がございます 🎁。プロフィールに生年月日をご登録ください！'],
    },
    'Dùng mã giảm giá thế nào?': {
      en: [/(use|apply|enter).*(code|coupon|voucher)|code (doesn'?t|not) work/, 'Enter the code at the **cart / checkout** step. A code may not apply if it has **expired, the minimum order isn\'t met** or it doesn\'t cover that dish. Send the code to our staff and we\'ll check 🙏'],
      ja: [/(コード|クーポン).*(使い方|使えない|入力)/, '**カート/お会計**画面でコードを入力してください。**有効期限切れ、最低注文金額未満**、対象外の料理の場合は適用されません。コードをスタッフにお送りいただければ確認します 🙏'],
    },
    // ---------------------------------------------------------- TAI KHOAN
    'Đăng ký tài khoản thế nào?': {
      en: [/(sign ?up|register|create (an )?account)/, 'Tap **Sign up**, enter your name, phone number, email and password and you\'re done ✅. With an account you can track orders, earn points and get member offers!'],
      ja: [/(登録|アカウント(を)?作|サインアップ|会員になり)/, '**新規登録**をタップし、お名前・電話番号・メール・パスワードを入力すれば完了です ✅。アカウントがあれば注文の追跡、ポイント獲得、会員特典をご利用いただけます！'],
    },
    'Quên mật khẩu': {
      en: [/(forgot|reset|lost).*(password)/, 'Tap **Forgot password** on the login page and enter your registered email to receive a reset link 🔐. If you don\'t get it, check your spam folder or call **{hotline}**.'],
      ja: [/(パスワード).*(忘れ|リセット|変更)/, 'ログイン画面の**パスワードを忘れた方**をタップし、登録メールアドレスを入力するとリセット用リンクが届きます 🔐。届かない場合は迷惑メールフォルダをご確認いただくか **{hotline}** へご連絡ください。'],
    },
    // ---------------------------------------------------------- GOP Y
    'Tôi muốn góp ý / khiếu nại': {
      en: [/(complain|complaint|feedback|bad (service|experience)|not happy|disappointed)/, 'I\'m truly sorry about your experience 🙏. Leave your **phone number** here or tap **Chat with staff** and a manager will contact you as soon as possible. All feedback helps us improve.'],
      ja: [/(苦情|クレーム|ご意見|不満|フィードバック)/, 'ご不快な思いをおかけし、誠に申し訳ございません 🙏。こちらに**電話番号**を残していただくか、**スタッフとチャット**をタップしてください。マネージャーより早急にご連絡いたします。'],
    },
    'Đánh giá nhà hàng ở đâu?': {
      en: [/(review|rate|rating)/, 'Thank you so much ❤️ You can leave a review in the **Reviews** section of the website; we read every one!'],
      ja: [/(レビュー|評価|口コミ)/, 'ありがとうございます ❤️ ウェブサイトの**レビュー**欄からご投稿いただけます。すべて拝見しております！'],
    },
    'Gặp nhân viên / người thật': {
      en: [/(talk to|speak to|chat with|contact).*(staff|human|person|someone|agent|manager)|human please|real human/, 'Let me connect you with our staff 👩‍💼 Tap **Chat with staff** or call **{hotline}** for direct support.'],
      ja: [/(スタッフ|人間|担当者|オペレーター).*(話|つない|チャット)/, 'スタッフにおつなぎします 👩‍💼 **スタッフとチャット**をタップするか、**{hotline}** へお電話ください。'],
    },
    'Nhà hàng có tuyển dụng không?': {
      en: [/(hiring|job|jobs|career|recruit|vacanc|work (at|for) you)/, 'We regularly hire **servers, kitchen assistants, cashiers and couriers** (full-time & part-time) 💼. Send your details via hotline **{hotline}** or email **{email}**!'],
      ja: [/(求人|採用|アルバイト|バイト|仕事|働きたい)/, '**ホールスタッフ、キッチン補助、レジ、配達員**（フルタイム・パートタイム）を随時募集しています 💼。ホットライン **{hotline}** またはメール **{email}** までご連絡ください！'],
    },
    'Hợp tác / quảng cáo': {
      en: [/(partnership|cooperat|collaborat|advertis|sponsor|business proposal)/, 'Thank you for your interest in working with us 🤝 Send your proposal to **{email}** or call **{hotline}** and the team in charge will reply soon.'],
      ja: [/(提携|協業|コラボ|広告|スポンサー)/, '提携へのご関心ありがとうございます 🤝 **{email}** または **{hotline}** までご提案をお送りください。担当部署よりご連絡いたします。'],
    },
    'Có bán thẻ quà tặng không?': {
      en: [/(gift (card|voucher|certificate))/, 'Contact **{hotline}** to order a **gift voucher** of any value 🎁, a lovely present for partners and loved ones!'],
      ja: [/(ギフト(券|カード)|商品券|プレゼント券)/, '**{hotline}** までご連絡いただければ、ご希望の金額で**ギフト券**をご用意します 🎁。取引先やご家族への贈り物にぴったりです！'],
    },
  },

  // Nhan nut lien ket + cau goi y (tieng Viet -> EN/JA). Bam goi y van gui cau
  // tieng Viet de kho khop chinh xac, chi chu hien tren nut la ban dich.
  nhan: {
    'Xem thực đơn': ['View menu', 'メニューを見る'],
    'Đặt bàn': ['Book a table', 'テーブル予約'],
    'Có khuyến mãi gì không?': ['Any promotions?', 'キャンペーンはありますか？'],
    'Địa chỉ nhà hàng': ['Restaurant address', '店舗の住所'],
    'Chat với nhân viên': ['Chat with staff', 'スタッフとチャット'],
    'Giao hàng': ['Delivery', 'デリバリー'],
    'Gợi ý món ngon': ['Recommend dishes', 'おすすめ料理'],
    'Món bán chạy nhất': ['Best sellers', '人気の料理'],
    'Đặt món giao tận nơi': ['Order for delivery', 'デリバリーを注文'],
    'Xem đánh giá': ['See reviews', 'レビューを見る'],
    'Món dưới 100k': ['Dishes under 100k', '10万ドン以下の料理'],
    'Có combo không?': ['Any combos?', 'セットはありますか？'],
    'Đặt bàn ngay': ['Book a table now', '今すぐ予約'],
    'Có chỗ đậu xe không?': ['Is there parking?', '駐車場はありますか？'],
    'Giờ mở cửa': ['Opening hours', '営業時間'],
    'Mở Google Maps': ['Open Google Maps', 'Googleマップを開く'],
    'Gọi ngay': ['Call now', '今すぐ電話'],
    'Đặt phòng VIP': ['Book a VIP room', 'VIPルームを予約'],
    'Đặt tiệc': ['Party booking', 'パーティー予約'],
    'Xem không gian': ['See our space', '店内を見る'],
    'Tổ chức sinh nhật': ['Birthday party', '誕生日会'],
    'Đặt bàn có cần cọc không?': ['Is a deposit required?', 'デポジットは必要ですか？'],
    'Hủy đặt bàn thế nào?': ['How do I cancel?', '予約のキャンセル方法'],
    'Có phòng VIP không?': ['Any VIP rooms?', 'VIPルームはありますか？'],
    'Hủy bàn có được hoàn cọc không?': ['Is the deposit refundable?', 'デポジットは返金されますか？'],
    'Xem chính sách cọc': ['Deposit policy', 'デポジット規定'],
    'Lịch sử đặt bàn': ['Booking history', '予約履歴'],
    'Đổi giờ đặt bàn được không?': ['Can I change the time?', '予約時間を変更できますか？'],
    'Lịch sử đặt tiệc': ['Party history', 'パーティー履歴'],
    'Thực đơn tiệc giá bao nhiêu?': ['Party menu prices', 'パーティーメニューの料金'],
    'Đặt cọc tiệc thế nào?': ['Party deposit', 'パーティーのデポジット'],
    'Đặt tiệc ngay': ['Book a party now', '今すぐパーティー予約'],
    'Xem gói tiệc': ['See party packages', 'パーティープランを見る'],
    'Có món lẩu không?': ['Any hot pot?', '鍋料理はありますか？'],
    'Đồ uống có gì?': ['What drinks are there?', 'ドリンクは何がありますか？'],
    'Combo': ['Combos', 'セット'],
    'Xem combo': ['See combos', 'セットを見る'],
    'Salad có những món nào?': ['Which salads?', 'サラダの種類は？'],
    'Món nướng có gì?': ['Grilled dishes', '焼き物は何がありますか？'],
    'Sashimi cá hồi giá bao nhiêu?': ['Salmon sashimi price?', 'サーモン刺身の値段は？'],
    'Giao hàng có mất phí không?': ['Is delivery free?', '送料はかかりますか？'],
    'Đặt món': ['Order food', '料理を注文'],
    'Phí giao hàng bao nhiêu?': ['Delivery fee?', '送料はいくら？'],
    'Giao trong bao lâu?': ['How long is delivery?', '配達時間は？'],
    'Chính sách giao hàng': ['Delivery policy', '配達ポリシー'],
    'Theo dõi đơn hàng': ['Track my order', '注文を追跡'],
    'Theo dõi đơn': ['Track order', '注文追跡'],
    'Đơn của tôi': ['My orders', 'マイオーダー'],
    'Có xuất hóa đơn VAT không?': ['VAT invoice?', 'VATインボイスは？'],
    'Phương thức thanh toán': ['Payment methods', 'お支払い方法'],
    'Thẻ thành viên có lợi gì?': ['Membership benefits', '会員特典'],
    'Ưu đãi sinh nhật': ['Birthday offer', '誕生日特典'],
    'Xem ưu đãi': ['See offers', '特典を見る'],
    'Đăng ký tài khoản': ['Create an account', 'アカウント登録'],
    'Quyền lợi thành viên': ['Member benefits', '会員特典'],
    'Đăng ký': ['Sign up', '新規登録'],
    'Tổ chức sinh nhật được không?': ['Birthday parties?', '誕生日会はできますか？'],
    'Hồ sơ của tôi': ['My profile', 'プロフィール'],
    'Ưu đãi của tôi': ['My offers', 'マイ特典'],
    'Quên mật khẩu': ['Forgot password', 'パスワードを忘れた'],
    'Đánh giá': ['Reviews', 'レビュー'],
    'Gọi hotline': ['Call hotline', 'ホットラインに電話'],
    'Xem chi tiết món': ['View dish details', '料理の詳細'],
    'Xem toàn bộ thực đơn': ['View full menu', '全メニューを見る'],
    'Xem giỏ hàng & đặt món': ['View cart & order', 'カートを見て注文'],
  },

  // Cau he thong (mac dinh trong trang Thiet lap AI).
  he_thong: {
    tin_khong_hieu: ['I\'m not quite sure about that 😅 Could you ask another way, or leave your **phone number** so our staff can call you?', 'すみません、よくわかりませんでした 😅 別の言い方でお尋ねいただくか、**電話番号**を残していただければスタッフからご連絡します。'],
    tin_goi_y_gan_dung: ['I\'m not sure I understood. Did you mean:', '正しく理解できたかわかりません。こちらのご質問でしょうか：'],
    tin_ngoai_gio: ['The assistant is currently off duty. Leave your **phone number** and question, and our staff will contact you as soon as we open!', '現在アシスタントの対応時間外です。**電話番号**とご質問を残していただければ、営業開始後すぐにスタッフからご連絡します！'],
    tin_cam_on_sdt: ['Thank you! I\'ve noted the number **{sdt}** 📞 Our staff will call you back as soon as possible.', 'ありがとうございます！**{sdt}** を承りました 📞 スタッフより折り返しご連絡いたします。'],
    tin_chuyen_nv: ['This question seems to need our staff. Tap **Chat with staff** or call **{hotline}** 🙏', 'このご質問はスタッフが対応いたします。**スタッフとチャット**をタップするか **{hotline}** へお電話ください 🙏'],
    tin_tu_cam: ['Let\'s keep our conversation polite and friendly 🙏 How can I help you?', '丁寧で楽しい会話をお願いいたします 🙏 何かお手伝いできることはありますか？'],
    loi_chao: ['Hello {ten_khach} 👋 I\'m **{ten_bot}** of {ten_nha_hang}. I can send you the menu with photos, dish prices, and help with table booking, parties or delivery. Just message me!', 'こんにちは、{ten_khach} 👋 {ten_nha_hang}の **{ten_bot}** です。写真付きメニュー、料理の価格、テーブル予約、パーティー、デリバリーのご案内ができます。お気軽にどうぞ！'],
    tat: ['The virtual assistant is temporarily off. Please go to **Chat** to message our staff.', 'AIアシスタントは現在停止中です。**チャット**からスタッフへご連絡ください。'],
  },

  // Tu mon an EN/JA -> tieng Viet de tim mon trong thuc don (ten mon tieng Viet).
  tu_mon: {
    en: [
      [/\bsalmon\b/g, 'cá hồi'], [/\btuna\b/g, 'cá ngừ'], [/\boysters?\b/g, 'hàu'], [/\b(shrimps?|prawns?)\b/g, 'tôm'],
      [/\bbeef\b/g, 'bò'], [/\bchicken\b/g, 'gà'], [/\bpork\b/g, 'heo'], [/\bscallops?\b/g, 'sò điệp'],
      [/\bsquid\b/g, 'mực'], [/\bocto(pus|pi)\b/g, 'bạch tuộc'], [/\beel\b/g, 'lươn'], [/\bcrab\b/g, 'cua'],
      [/\bhot ?pot\b/g, 'lẩu'], [/\bgrilled\b/g, 'nướng'], [/\bfried rice\b/g, 'cơm chiên'], [/\bnoodles?\b/g, 'mì'],
      [/\bdrinks?|beverages?\b/g, 'đồ uống'], [/\bdesserts?\b/g, 'tráng miệng'], [/\bsalads?\b/g, 'salad'],
      [/\bbest[- ]?sell(ers?|ing)\b|\bmost popular\b/g, 'món bán chạy nhất'],
      [/\bunder (\d+)k\b/g, 'món dưới $1k'], [/\bcheap(est)?\b/g, 'rẻ nhất'],
    ],
    ja: [
      [/サーモン|鮭/g, 'cá hồi'], [/マグロ|まぐろ|鮪/g, 'cá ngừ'], [/牡蠣|カキ|かき/g, 'hàu'], [/エビ|えび|海老/g, 'tôm'],
      [/牛肉|牛/g, 'bò'], [/鶏肉|チキン|鶏/g, 'gà'], [/豚肉|豚/g, 'heo'], [/ホタテ|帆立/g, 'sò điệp'],
      [/イカ|いか/g, 'mực'], [/タコ|たこ/g, 'bạch tuộc'], [/ウナギ|うなぎ|鰻/g, 'lươn'], [/カニ|かに|蟹/g, 'cua'],
      [/鍋/g, 'lẩu'], [/焼き/g, 'nướng'], [/寿司|すし|鮨/g, 'sushi'], [/刺身|さしみ/g, 'sashimi'], [/握り/g, 'nigiri'],
      [/巻き/g, 'maki'], [/ラーメン/g, 'ramen'], [/うどん/g, 'udon'], [/天ぷら|天麩羅/g, 'tempura'], [/鉄板焼き?/g, 'teppanyaki'],
      [/チャーハン/g, 'cơm chiên'], [/ドリンク|飲み物/g, 'đồ uống'], [/デザート/g, 'tráng miệng'], [/サラダ/g, 'salad'],
      [/人気|売れ筋|一番売れ/g, 'món bán chạy nhất'], [/味噌汁/g, 'súp miso'],
    ],
  },
};
