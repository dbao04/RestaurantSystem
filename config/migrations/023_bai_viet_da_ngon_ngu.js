/**
 * Migration 023 - Bai viet co ban dich tieng Anh va tieng Nhat.
 *
 * VAN DE
 * Giao dien trang Tin tuc da dich day du (nut, nhan, ngay thang, "X phut doc").
 * Nhung NOI DUNG bai viet thi nam trong bang `bai_viet` va chi co mot ban tieng
 * Viet, nen khach xem ban tieng Nhat thay mot trang toan chu Nhat voi sau khoi
 * van xuoi tieng Viet o giua.
 *
 * VI SAO KHONG DICH TU DONG NHU TEN MON
 * Ten mon dich duoc vi co san ten tieng Anh trong cot `monan.ghichu_mon` de suy
 * ra. Van xuoi thi khong co nguon nao de suy - bat buoc phai co nguoi viet ban
 * dich, hoac goi dich vu dich may (can khoa API va Internet, va nha hang nay
 * chay trong mang noi bo). Nen cach dung la them cot va cho nguoi viet bai nhap.
 *
 * LAM GI
 *   1. Them 4 cot: tieu_de_en, noi_dung_en, tieu_de_ja, noi_dung_ja.
 *   2. Nap ban dich cho 6 bai dang co.
 *
 * Bai nao chua co ban dich thi trang tin tuc tu lui ve tieng Viet VA hien dong
 * "Bai viet hien chi co ban tieng Viet" - dong do da co san, gio no moi noi
 * dung su that thay vi noi ve moi bai.
 *
 * Chay lai duoc nhieu lan: cot them bang IF NOT EXISTS, ban dich chi ghi khi o
 * do dang trong nen khong de len phan nguoi dung da tu sua.
 */
const db = require('../db');

const COT = [
  ['tieu_de_en', "VARCHAR(255) DEFAULT NULL"],
  ['noi_dung_en', 'TEXT DEFAULT NULL'],
  ['tieu_de_ja', "VARCHAR(255) DEFAULT NULL"],
  ['noi_dung_ja', 'TEXT DEFAULT NULL'],
];

const BAN_DICH = {
  1: {
    en: {
      tieu_de: 'Rooftop now open: dinner under the Saigon sky',
      noi_dung: `From this month, Nha Hang Bao Doan officially opens its rooftop area with 12 outdoor tables looking out over the city skyline.

The space is designed around the idea of a garden in the city: rows of olive trees, warm glass lanterns and a retractable roof for sudden rain. Each table is private enough for a dinner for two, yet can be joined into a long table for groups of up to 10.

The rooftop menu was created separately by our head chef, focused on charcoal-grilled dishes and seasonal seafood, alongside a wine list of more than 40 labels chosen to suit a tropical climate.

The area serves from 5:30 pm to 10:30 pm daily. As seating is limited, please book at least one day ahead so we can prepare properly for you.`,
    },
    ja: {
      tieu_de: 'ルーフトップ開業：サイゴンの空の下でのディナー',
      noi_dung: `今月より、レストラン・バオドアンは屋上エリアを正式にオープンいたします。屋外席は12卓、市街のスカイラインを一望できます。

「街の中の庭」という発想で設計しました。オリーブの並木、あたたかな光のガラスランタン、そして急な雨にも対応する開閉式の屋根。各テーブルはお二人での食事に十分な落ち着きを保ちながら、最大10名様までのグループ用に連結することもできます。

屋上専用のメニューは料理長が別途構成したもので、炭火焼きと旬の魚介を中心に、熱帯の気候に合わせて選んだ40種類以上のワインを取り揃えています。

営業時間は毎日17時30分から22時30分まで。席数に限りがございますので、万全のご用意のため、少なくとも前日までのご予約をお願いいたします。`,
    },
  },
  2: {
    en: {
      tieu_de: 'New seasonal menu: fish in season, flavour left alone',
      noi_dung: `After three months of testing in the kitchen, the Bao Doan team presents a new seasonal menu of 14 dishes, 9 of them appearing for the first time.

The guiding idea is still shun — use each ingredient in its own season, and hold back so the original flavour can speak. Amberjack at its fattest is sliced thicker than usual for sashimi, served with nothing but ponzu. Hyogo oysters arrive by shipment and are served both as sashimi and grilled with mentaiko sauce. The new appetiser is onsen egg with sea urchin — two soft things meeting, nothing else required.

Among the hot dishes we have added a seafood nabe hotpot and stone-grilled wagyu, for evenings when the weather turns cool. We have also set aside four dishes for vegetarian guests, prepared to the same standard and the same timing as the rest of the menu — because eating vegetarian does not mean eating simpler.

The new seasonal menu is now available at the restaurant. You can see details and prices on the Menu page, or ask our service team directly.`,
    },
    ja: {
      tieu_de: '新しい季節のメニュー：旬の魚を、そのままの味で',
      noi_dung: `厨房での3か月にわたる試作を経て、バオドアンのチームが14品の新しい季節のメニューをご紹介します。うち9品は初登場です。

一貫した考え方は「旬」です。それぞれの食材をその季節に使い、手を加えすぎず、素材そのものの味に語らせること。脂ののったカンパチは通常より厚めに引き、ポン酢だけでお召し上がりいただきます。兵庫県産の牡蠣は入荷ごとに、刺身と明太子ソース焼きの両方でご用意。新しい前菜は温泉卵とうにです。やわらかいもの同士が出会えば、それ以上は要りません。

温かい料理には、冷え込む夜のために海鮮鍋と和牛の石焼きを加えました。ベジタリアンのお客様には4品をご用意しています。ほかのメニューと同じ基準、同じ手間をかけています。精進料理だからといって、簡素でよいわけではありません。

新しい季節のメニューはすでに店内でご提供中です。詳細と価格はメニューページ、またはサービススタッフに直接おたずねください。`,
    },
  },
  4: {
    en: {
      tieu_de: 'From the kitchen: the head chef’s 12-hour broth',
      noi_dung: `Every day, the lights come on in the Bao Doan kitchen at 4 am. The first task is not preparing meat or fish, but setting on the stove the pot of broth that will stay with our guests for the rest of that day.

Beef bones are roasted first at high heat to bring out their aroma, then simmered gently with charred onion, ginger, cinnamon and black cardamom. For 12 hours, the broth is skimmed by hand every 30 minutes. There is no shortcut for this stage.

Our head chef often says: a guest may not be able to name the thing that makes the difference, but the tongue always knows. A clear bowl of soup, sweet at the finish and without the sharp edge of MSG, is the result of those 12 patient hours.

That is also why we limit the number of servings each day. When the pot runs out, we stop serving that dish — rather than rushing a new pot.`,
    },
    ja: {
      tieu_de: '厨房から：料理長の12時間のだし',
      noi_dung: `バオドアンの厨房には、毎日午前4時に灯りがともります。最初の仕事は肉や魚の下ごしらえではなく、その日一日お客様に寄り添うことになるだしを火にかけることです。

牛骨はまず高温で焼いて香りを引き出し、その後、焼いた玉ねぎ、生姜、シナモン、カルダモンとともに弱火でじっくり煮込みます。12時間のあいだ、30分ごとに手作業で灰汁を取り続けます。この工程に近道はありません。

料理長がよく口にする言葉があります。お客様は何が違うのかを言葉にできないかもしれない、けれど舌は必ず分かる、と。澄んだスープ、あと味に残る甘み、うま味調味料のような尖った後味がないこと。それが12時間の忍耐の結果です。

一日の提供数を限らせていただいているのもそのためです。だしがなくなった時点でその料理の提供を終えます。急いで新しい鍋を仕立てることはいたしません。`,
    },
  },
  5: {
    en: {
      tieu_de: 'Sake night: every Friday at the Bao Doan sushi counter',
      noi_dung: `Starting this month, every Friday evening from 7:30 pm, our sushi counter hosts a sake tasting led by the head chef himself.

The session runs for two hours and introduces four sakes — from a junmai rich with rice character to a light, fresh yuzu — each paired with a dish chosen for it. Between the two halves there is a 15-minute break so you can enjoy the main course in quiet.

During these hours the restaurant serves a Sake Night set for two, with a seasonal sashimi plate, two grilled dishes and four tasting glasses of sake.

Seats at the sushi counter are limited — it is also the seat from which you can watch the chef work. Please book early and note “Sake Night” so we can give you priority seating.`,
    },
    ja: {
      tieu_de: '日本酒の夜：毎週金曜、バオドアンの寿司カウンターにて',
      noi_dung: `今月より毎週金曜の19時30分から、当店の寿司カウンターで料理長みずから案内する日本酒のテイスティングを開催いたします。

会は2時間。米の旨みが濃い純米酒から、軽やかな柚子のお酒まで4種類をご紹介し、それぞれに合わせて選んだ一品を添えます。前半と後半のあいだには15分の休憩を設け、静かにメインをお楽しみいただけます。

この時間帯には、二名様向けの「日本酒の夜」セットをご用意します。旬の刺身の盛り合わせ、焼き物二品、そして日本酒の利き酒4杯つきです。

寿司カウンターの席数には限りがございます。板前の仕事を間近でご覧いただける席でもあります。お早めにご予約のうえ、「日本酒の夜」とご記入ください。優先してお席をご用意いたします。`,
    },
  },
  6: {
    en: {
      tieu_de: 'The journey of an ingredient: from a Da Lat farm to your table',
      noi_dung: `Twice a week, our refrigerated truck leaves Da Lat at midnight and reaches the Bao Doan kitchen door before 8 am the next morning.

We work directly with four farms in Don Duong and Lac Duong, with no middlemen. Vegetables are harvested in the cool of the afternoon, trimmed and chilled right at the garden to keep them crisp. Because of that, the lettuce on your salad plate is usually less than 20 hours from the moment it was cut from the bed.

For seafood we source from Phan Thiet and Cam Ranh, favouring catches landed the same day. Our supplier list is reviewed regularly, and every consignment has traceability paperwork kept at the restaurant.

We believe a good dish begins long before the pan goes on the heat.`,
    },
    ja: {
      tieu_de: '食材の旅：ダラットの農場からお客様の食卓へ',
      noi_dung: `週に二度、当店の冷蔵車は深夜にダラットを出発し、翌朝8時前にはバオドアンの厨房の入口に到着します。

ドンズオンとラクズオンにある4つの農場と、仲介を挟まず直接お取引しています。野菜は涼しい午後に収穫し、畑でそのまま下処理と冷却を行って歯ごたえを保ちます。そのため、サラダのレタスは畑で切られてから20時間と経っていないことがほとんどです。

魚介はファンティエットとカムランから仕入れ、その日に水揚げされたものを優先しています。仕入先の一覧は定期的に見直し、すべての入荷にはトレーサビリティの記録を店内に保管しています。

よい一皿は、鍋を火にかけるずっと前から始まっている。私たちはそう考えています。`,
    },
  },
  7: {
    en: {
      tieu_de: 'Loyalty programme: earn points, redeem dishes, receive offers',
      noi_dung: `Nha Hang Bao Doan would like to thank you for being with us. Our loyalty programme now applies to every bill at the restaurant and to online orders.

It works simply: for every 10,000 VND spent, you receive 1 point in your account. Points are added automatically as soon as payment succeeds — no physical card to present.

Points can be used for a dessert, an appetiser, or taken directly off your bill. Guests at higher tiers get priority table holds at weekends and a gift during their birthday month.

All you need to do is register an account on the website and sign in before booking a table or ordering, and your points start accumulating.`,
    },
    ja: {
      tieu_de: 'メンバーシップ制度：ポイントを貯めて、お料理や割引に',
      noi_dung: `レストラン・バオドアンをご利用いただき、誠にありがとうございます。メンバーシップ制度は、店内でのすべてのお会計とオンラインでのご注文に適用されるようになりました。

仕組みは簡単です。10,000ドンのお支払いごとに1ポイントがアカウントに加算されます。お支払いが完了した時点で自動的に加算されますので、カードをご提示いただく必要はありません。

貯まったポイントは、デザートや前菜との交換、またはお会計からの直接のお値引きにご利用いただけます。上位ランクのお客様には、週末のお席の優先確保と、お誕生月の贈り物をご用意しています。

ウェブサイトでアカウントを登録し、ご予約やご注文の前にログインしていただくだけで、ポイントが貯まりはじめます。`,
    },
  },
};

async function themCot() {
  const [co] = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'bai_viet'`
  );
  const daCo = new Set(co.map((c) => c.column_name || c.COLUMN_NAME));

  let them = 0;
  for (const [ten, kieu] of COT) {
    if (daCo.has(ten)) continue;
    await db.query(`ALTER TABLE bai_viet ADD COLUMN ${ten} ${kieu}`);
    them++;
  }
  console.log(`  Cot ban dich             : them ${them}, da co ${COT.length - them}`);
}

async function napBanDich() {
  let nap = 0;
  let boQua = 0;

  for (const [id, ban] of Object.entries(BAN_DICH)) {
    const [rows] = await db.query(
      'SELECT id_bv, tieu_de_en, tieu_de_ja FROM bai_viet WHERE id_bv = ?', [id]
    );
    if (!rows.length) { boQua++; continue; }

    // Chi ghi vao o dang TRONG: nguoi viet bai co the da tu sua lai cau chu,
    // chay lai migration khong duoc de len cong cua ho.
    const r = rows[0];
    const dat = [];
    const gt = [];
    if (!r.tieu_de_en) { dat.push('tieu_de_en = ?', 'noi_dung_en = ?'); gt.push(ban.en.tieu_de, ban.en.noi_dung); }
    if (!r.tieu_de_ja) { dat.push('tieu_de_ja = ?', 'noi_dung_ja = ?'); gt.push(ban.ja.tieu_de, ban.ja.noi_dung); }
    if (!dat.length) { boQua++; continue; }

    gt.push(id);
    await db.query(`UPDATE bai_viet SET ${dat.join(', ')} WHERE id_bv = ?`, gt);
    nap++;
  }
  console.log(`  Ban dich                 : nap ${nap} bai, bo qua ${boQua} (da co hoac khong ton tai)`);
}

async function kiemTra() {
  console.log('\n  Kiem tra:');
  const [[t]] = await db.query(`
    SELECT COUNT(*) AS tong,
           SUM(tieu_de_en IS NOT NULL AND tieu_de_en <> '') AS co_en,
           SUM(tieu_de_ja IS NOT NULL AND tieu_de_ja <> '') AS co_ja
    FROM bai_viet`);
  console.log(`      tong bai viet            : ${t.tong}`);
  console.log(`      co ban tieng Anh         : ${t.co_en}`);
  console.log(`      co ban tieng Nhat        : ${t.co_ja}`);

  const [thieu] = await db.query(
    `SELECT id_bv, tieu_de FROM bai_viet
     WHERE tieu_de_en IS NULL OR tieu_de_en = '' OR tieu_de_ja IS NULL OR tieu_de_ja = ''`
  );
  if (thieu.length) {
    console.log(`      bai chua du ban dich     : ${thieu.length}`);
    thieu.forEach((b) => console.log(`         #${b.id_bv} ${String(b.tieu_de).slice(0, 46)}`));
    console.log('      (nhung bai nay van hien tieng Viet kem dong bao "chi co ban tieng Viet")');
  }
}

async function main() {
  console.log('=== Migration 023: bai viet da ngon ngu ===');
  await themCot();
  await napBanDich();
  await kiemTra();
  console.log('\n=== Hoan tat migration 023 ===');
  console.log('Buoc tiep theo: vao /admin/bloglist, sua mot bai de thay hai o ban dich moi.');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
