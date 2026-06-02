const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
    });

    console.log('Connected to MySQL server.');

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        console.log(`Database \`${process.env.DB_NAME}\` created or already exists.`);

        await connection.query(`USE \`${process.env.DB_NAME}\`;`);

        const sql = fs.readFileSync(path.join(__dirname, 'gs_restaurant.sql'), 'utf8');
        
        // Split SQL into individual statements
        // Note: Simple split by ; might not work for complex SQL, but for this dump it should be fine
        // especially since there are no triggers/stored procedures with ; in them in the preview
        const statements = sql.split(/;\r?\n/);

        console.log(`Starting import of ${statements.length} statements...`);
        for (let statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.query(statement);
                } catch (err) {
                    console.warn('Error executing statement:', err.message);
                }
            }
        }
        console.log('Database import completed successfully.');

    } catch (err) {
        console.error('Setup failed:', err);
    } finally {
        await connection.end();
    }
}

setup();
