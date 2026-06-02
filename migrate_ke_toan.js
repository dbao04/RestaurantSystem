const db = require('./config/db');

async function migrate() {
    try {
        await db.query("UPDATE nhan_vien SET chucvu = 'Ke toan' WHERE chucvu = 'Thu ngan'");
        console.log("Successfully migrated 'Thu ngan' to 'Ke toan' in database.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
